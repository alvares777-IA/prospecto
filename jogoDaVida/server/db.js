// Acesso ao Postgres do stack (banco `jogodavida`).
// Substitui o server/ords.js previsto na spec — não há ORDS nem token OAuth aqui.

import pg from 'pg';                    // pacote CommonJS: importa o default e desestrutura
const { Pool } = pg;

// O Pool mantém um punhado de conexões abertas e reaproveita entre queries —
// abrir conexão por request é caro. `pool.query()` pega uma livre, roda, devolve.
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,      // desiste de obter conexão em 5s
    statement_timeout: 10000,           // mata query que passe de 10s
});

// Conexão ociosa que cai (restart do Postgres, timeout) emite 'error' no pool.
// Sem este handler, o processo Node inteiro derruba.
pool.on('error', (err) => console.error('[db] erro em conexão ociosa:', err.message));

// Checagem de vida usada pelo /health.
export async function ping() {
    const { rows } = await pool.query('SELECT now() AS agora');
    return rows[0].agora;
}
