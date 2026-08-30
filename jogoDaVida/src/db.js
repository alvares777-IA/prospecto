const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// DDL idempotente rodado no boot — espelha jogoDaVida/sql/schema.sql.
const migrations = [
  `CREATE TABLE IF NOT EXISTS jv_usuarios (
      id         SERIAL       PRIMARY KEY,
      nome       VARCHAR(120) NOT NULL,
      email      VARCHAR(120) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      perfil     VARCHAR(20)  NOT NULL DEFAULT 'jogador' CHECK (perfil IN ('admin', 'jogador')),
      ativo      BOOLEAN      NOT NULL DEFAULT true,
      criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS jv_sessoes (
      sid    VARCHAR     NOT NULL PRIMARY KEY,
      sess   JSON        NOT NULL,
      expire TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_jv_sessoes_expire ON jv_sessoes (expire)`,
];

(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch(err => console.error('[db] Migração falhou:', err.message));
  }
})();

module.exports = { pool };
