// Gravação no Postgres: jogador, sessao (uma por sala/código), presenca.
// Chamado pelos handlers de socket em "seguir e reconciliar" — a sala já
// respondeu ao vivo antes destas queries terminarem (docs §6).

import os from 'node:os';
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

// Existe uma sessão aberta com este código?
export async function salaAberta(codigo) {
    const r = await pool.query(
        `SELECT 1 FROM sessao WHERE codigo = $1 AND dt_encerramento IS NULL`,
        [codigo],
    );
    return r.rowCount > 0;
}

// Entrada numa sala, numa transação:
//   - upsert do jogador por identificador
//   - sessão da sala: reusa a aberta com esse código, ou cria (se `criando`)
//   - linha de presença
// Devolve { jogadorId, sessaoId, presencaId, souCriador } ou { erro }.
export async function registrarEntradaEmSala({ nome, avatar_codigo, salaCodigo, criando }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const jog = await client.query(
            `INSERT INTO jogador (identificador, apelido, avatar_codigo)
             VALUES ($1, $1, $2)
             ON CONFLICT (identificador) DO UPDATE
                SET apelido = EXCLUDED.apelido,
                    avatar_codigo = EXCLUDED.avatar_codigo
             RETURNING id`,
            [nome, avatar_codigo],
        );
        const jogadorId = jog.rows[0].id;

        // serializa o get-or-create da sessão entre entradas concorrentes
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sala:${salaCodigo}`]);

        const achou = await client.query(
            `SELECT id, criador_id FROM sessao WHERE codigo = $1 AND dt_encerramento IS NULL`,
            [salaCodigo],
        );

        let sessaoId, criadorId;
        if (achou.rows[0]) {
            sessaoId  = achou.rows[0].id;
            criadorId = achou.rows[0].criador_id;
        } else if (criando) {
            const nova = await client.query(
                `INSERT INTO sessao (codigo, zona_id, servidor_host, criador_id)
                 SELECT $1, z.id, $2, $3 FROM zona z WHERE z.codigo = 'SALA_A'
                 RETURNING id`,
                [salaCodigo, HOST, jogadorId],
            );
            sessaoId  = nova.rows[0].id;
            criadorId = jogadorId;
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
            sessaoId,
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
