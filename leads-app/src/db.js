const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Migrações executadas na inicialização
pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT;

    CREATE TABLE IF NOT EXISTS tokens_senha (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expira_em  TIMESTAMPTZ NOT NULL,
        usado      BOOLEAN DEFAULT false,
        criado_em  TIMESTAMPTZ DEFAULT NOW()
    );
`).catch(err => console.error('[db] Erro na migração:', err.message));

module.exports = { pool };
