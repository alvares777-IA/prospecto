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
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_lead') THEN
       ALTER TYPE status_lead ADD VALUE IF NOT EXISTS 'sem_interesse';
     END IF;
   END $$`,
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
  `CREATE TABLE IF NOT EXISTS leads_status (
      id          SERIAL PRIMARY KEY,
      id_lead     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      status_lead VARCHAR(20) NOT NULL,
      dt_status   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_leads_status_id_lead ON leads_status (id_lead)`,
  `CREATE OR REPLACE FUNCTION fn_registrar_status_lead()
   RETURNS TRIGGER LANGUAGE plpgsql AS $$
   BEGIN
       IF TG_OP = 'INSERT' THEN
           INSERT INTO leads_status (id_lead, status_lead, dt_status)
           VALUES (NEW.id, NEW.status::text, NOW());
       ELSIF TG_OP = 'UPDATE' AND NEW.status::text <> OLD.status::text THEN
           INSERT INTO leads_status (id_lead, status_lead, dt_status)
           VALUES (NEW.id, NEW.status::text, NOW());
       END IF;
       RETURN NEW;
   END;
   $$`,
  `DROP TRIGGER IF EXISTS trg_leads_status ON leads`,
  `CREATE TRIGGER trg_leads_status
       AFTER INSERT OR UPDATE ON leads
       FOR EACH ROW EXECUTE FUNCTION fn_registrar_status_lead()`,
  `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar VARCHAR(255)`,
];

(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch(err => console.error('[db] Migração falhou:', err.message));
  }
})();

module.exports = { pool };
