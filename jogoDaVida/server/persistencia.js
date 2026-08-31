// Gravação no Postgres: jogador, sessao (uma por sala/código), presenca.
// Chamado pelos handlers de socket em "seguir e reconciliar" — a sala já
// respondeu ao vivo antes destas queries terminarem (docs §6).

import os from 'node:os';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

// Identifica ESTE processo/servidor. No container é o hostname do container,
// estável entre reinícios do nodemon; muda só quando o container é recriado.
const HOST = process.env.HOSTNAME || os.hostname();

// Códigos de avatar válidos — carregados uma vez, em cache. Validação no
// servidor (o navegador não decide nada).
let _avatares = null;
export async function avataresValidos() {
    if (!_avatares) {
        const r = await pool.query(`SELECT codigo FROM avatar WHERE ativo = 'S'`);
        _avatares = new Set(r.rows.map(x => x.codigo));
    }
    return _avatares;
}

// Sessão aberta com este código, se houver: { sessaoId, estado }.
export async function salaInfo(codigo) {
    const r = await pool.query(
        `SELECT id, estado FROM sessao WHERE codigo = $1 AND dt_encerramento IS NULL`,
        [codigo],
    );
    return r.rows[0] ? { sessaoId: r.rows[0].id, estado: r.rows[0].estado } : null;
}

// Marca a sessão como em jogo. Devolve true se mudou (estava 'aguardando').
export async function iniciarJogo(sessaoId) {
    const r = await pool.query(
        `UPDATE sessao SET estado = 'em_jogo'
          WHERE id = $1 AND estado = 'aguardando'`,
        [sessaoId],
    );
    return r.rowCount > 0;
}

// ── Contas ──────────────────────────────────────────────────────────
const CUSTO_BCRYPT = 12;

export async function criarConta({ email, senha, apelido }) {
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    try {
        const r = await pool.query(
            `INSERT INTO jogador (identificador, apelido, anonimo, email, senha_hash)
             VALUES ($1, $2, 'N', $1, $3)
             RETURNING id, apelido, identificador`,
            [email.toLowerCase().trim(), apelido.trim().slice(0, 64), hash],
        );
        return { jogador: r.rows[0] };
    } catch (err) {
        if (err.code === '23505') return { erro: 'Esse e-mail já tem conta.' };
        throw err;
    }
}

export async function loginPorEmail({ email, senha }) {
    const r = await pool.query(
        `SELECT id, apelido, identificador, senha_hash FROM jogador
          WHERE email = $1 AND anonimo = 'N'`,
        [email.toLowerCase().trim()],
    );
    const j = r.rows[0];
    if (!j || !j.senha_hash || !(await bcrypt.compare(senha, j.senha_hash))) {
        return { erro: 'E-mail ou senha incorretos.' };
    }
    return { jogador: { id: j.id, apelido: j.apelido, identificador: j.identificador } };
}

// Login/cadastro via Google. `sub` é o id estável do Google.
export async function upsertGoogle({ sub, email, apelido }) {
    const ident = 'google:' + sub;
    const r = await pool.query(
        `INSERT INTO jogador (identificador, apelido, anonimo, email, google_id)
         VALUES ($1, $2, 'N', $3, $4)
         ON CONFLICT (identificador) DO UPDATE SET apelido = EXCLUDED.apelido
         RETURNING id, apelido, identificador`,
        [ident, (apelido || 'Jogador').slice(0, 64), email || null, sub],
    );
    return { jogador: r.rows[0] };
}

// Anônimo "perde tudo ao sair": apaga o jogador — as presenças caem por
// ON DELETE CASCADE e as salas que ele criou ficam com criador_id NULL.
export async function apagarAnonimo(jogadorId) {
    if (!jogadorId) return;
    try {
        await pool.query(`DELETE FROM jogador WHERE id = $1 AND anonimo = 'S'`, [jogadorId]);
    } catch (err) {
        console.warn('[persistencia] não apaguei anônimo', jogadorId, ':', err.message);
    }
}

// ── Entrada numa sala ───────────────────────────────────────────────
// Numa transação: upsert do jogador por identificador (conta estável ou
// 'anon:'<uuid> gerado uma vez por socket) + get-or-create da sessão da
// sala + linha de presença.
// Devolve { jogadorId, anonimo, sessaoId, presencaId, souCriador, estado } ou { erro }.
export async function registrarEntradaEmSala({ identificador, apelido, avatar_codigo, anonimo, salaCodigo, criando }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const jog = await client.query(
            `INSERT INTO jogador (identificador, apelido, avatar_codigo, anonimo)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (identificador) DO UPDATE
                SET apelido = EXCLUDED.apelido,
                    avatar_codigo = EXCLUDED.avatar_codigo
             RETURNING id, anonimo`,
            [identificador, apelido, avatar_codigo, anonimo ? 'S' : 'N'],
        );
        const jogadorId = jog.rows[0].id;

        // serializa o get-or-create da sessão entre entradas concorrentes
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sala:${salaCodigo}`]);

        const achou = await client.query(
            `SELECT id, criador_id, estado FROM sessao
              WHERE codigo = $1 AND dt_encerramento IS NULL`,
            [salaCodigo],
        );

        let sessaoId, criadorId, estado;
        if (achou.rows[0]) {
            sessaoId  = achou.rows[0].id;
            criadorId = achou.rows[0].criador_id;
            estado    = achou.rows[0].estado;
        } else if (criando) {
            const nova = await client.query(
                `INSERT INTO sessao (codigo, zona_id, servidor_host, criador_id)
                 SELECT $1, z.id, $2, $3 FROM zona z WHERE z.codigo = 'SALA_A'
                 RETURNING id, estado`,
                [salaCodigo, HOST, jogadorId],
            );
            sessaoId  = nova.rows[0].id;
            criadorId = jogadorId;
            estado    = nova.rows[0].estado;
        } else {
            await client.query('ROLLBACK');
            return { erro: 'sala_inexistente' };
        }

        const pres = await client.query(
            `INSERT INTO presenca (sessao_id, jogador_id) VALUES ($1, $2) RETURNING id`,
            [sessaoId, jogadorId],
        );

        await client.query('COMMIT');
        return {
            jogadorId,
            anonimo: jog.rows[0].anonimo === 'S',
            sessaoId,
            estado,
            presencaId: pres.rows[0].id,
            souCriador: criadorId === jogadorId,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// Carimba a saída na linha de presença exata (id guardado no estado vivo).
export async function registrarSaida(presencaId) {
    if (!presencaId) return;
    await pool.query(
        `UPDATE presenca SET dt_saida = now() WHERE id = $1 AND dt_saida IS NULL`,
        [presencaId],
    );
}

// Fecha as sessões abertas deste processo — chamado no shutdown (SIGTERM/SIGINT).
export async function encerrarSessoes() {
    await pool.query(
        `UPDATE sessao SET dt_encerramento = now()
          WHERE servidor_host = $1 AND dt_encerramento IS NULL`,
        [HOST],
    );
}
