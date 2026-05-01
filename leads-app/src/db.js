const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_lid TEXT`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message_id TEXT`,
  `ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check`,
  `ALTER TABLE leads ADD CONSTRAINT leads_status_check
      CHECK (status::text = ANY(ARRAY['novo','contactado','interessado','convertido','descartado','sem_interesse']))`,
  `CREATE TABLE IF NOT EXISTS tokens_senha (
      id         SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expira_em  TIMESTAMPTZ NOT NULL,
      usado      BOOLEAN DEFAULT false,
      criado_em  TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS campanhas (
      id        SERIAL PRIMARY KEY,
      descricao VARCHAR(120) NOT NULL,
      texto     TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO campanhas (id, descricao, texto)
   VALUES (1, 'Campanha Padrão', 'Olá {nome}, tudo bem? Temos uma solução para seu condomínio. Posso te apresentar em 2 minutos?')
   ON CONFLICT (id) DO NOTHING`,
  `SELECT setval('campanhas_id_seq', (SELECT MAX(id) FROM campanhas))`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS campanha_id INTEGER REFERENCES campanhas(id)`,
  `UPDATE leads SET campanha_id = 1 WHERE campanha_id IS NULL`,
  `ALTER TABLE leads ALTER COLUMN campanha_id SET NOT NULL`,
];

(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch(err => console.error('[db] Migração falhou:', err.message));
  }
})();

module.exports = { pool };
