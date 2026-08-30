// Gravação no Postgres. Equivale ao POST /sessao + POST /presenca da spec
// (sem ORDS). Chamado pelos handlers de socket em "seguir e reconciliar":
// a sala já respondeu ao vivo antes destas queries terminarem (docs §6).

import os from 'node:os';
import { pool } from './db.js';

// Identifica ESTE processo/servidor. No container é o hostname do container,
// estável entre reinícios do nodemon; muda só quando o container é recriado.
const HOST = process.env.HOSTNAME || os.hostname();

// Códigos de avatar válidos — carregados uma vez, em cache. Usado para validar
// no servidor (o navegador não decide nada).
let _avatares = null;
export async function avataresValidos() {
    if (!_avatares) {
        const r = await pool.query(`SELECT codigo FROM avatar WHERE ativo = 'S'`);
        _avatares = new Set(r.rows.map(x => x.codigo));
    }
    return _avatares;
}

// get-or-create da sessão aberta desta zona neste processo.
async function sessaoAberta(client, zonaCodigo) {
    // Serializa o get-or-create entre entradas concorrentes — 4 jogadores podem
    // entrar quase ao mesmo tempo e todos verem "nenhuma sessão aberta". O lock
    // é por (zona|host) e some no fim da transação.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${zonaCodigo}|${HOST}`]);

    const existe = await client.query(
        `SELECT s.id
           FROM sessao s
           JOIN zona z ON z.id = s.zona_id
          WHERE z.codigo = $1
            AND s.servidor_host = $2
            AND s.dt_encerramento IS NULL
          ORDER BY s.id DESC
          LIMIT 1`,
        [zonaCodigo, HOST],
    );
    if (existe.rows[0]) return existe.rows[0].id;

    const criada = await client.query(
        `INSERT INTO sessao (zona_id, servidor_host)
         SELECT id, $2 FROM zona WHERE codigo = $1
         RETURNING id`,
        [zonaCodigo, HOST],
    );
    return criada.rows[0].id;
}

// Jogador (upsert por identificador) + sessão + linha de presença.
// Tudo numa transação: ou grava a entrada inteira, ou nada.
export async function registrarEntrada({ nome, avatar_codigo, salaCodigo }) {
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

        const sessaoId = await sessaoAberta(client, salaCodigo);

        const pres = await client.query(
            `INSERT INTO presenca (sessao_id, jogador_id) VALUES ($1, $2) RETURNING id`,
            [sessaoId, jogadorId],
        );

        await client.query('COMMIT');
        return { jogadorId, sessaoId, presencaId: pres.rows[0].id };
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
