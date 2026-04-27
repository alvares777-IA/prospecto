-- Schema do banco de leads — Prospecto-IA
-- Aplicar com: docker exec -i prospecto-postgres-1 psql -U prospecto -d leads < postgres/schema.sql

CREATE TYPE status_lead AS ENUM (
    'novo',
    'contactado',
    'interessado',
    'convertido',
    'descartado'
);

CREATE TABLE IF NOT EXISTS leads (
    id              SERIAL PRIMARY KEY,
    telefone        VARCHAR(20)  NOT NULL,
    nome            VARCHAR(120),
    empresa         VARCHAR(120),
    cargo           VARCHAR(80),
    email           VARCHAR(120),
    status          status_lead  NOT NULL DEFAULT 'novo',
    origem          VARCHAR(60),
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- telefone é a chave natural de busca no WhatsApp
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_telefone ON leads (telefone);
CREATE        INDEX IF NOT EXISTS idx_leads_status    ON leads (status);

-- atualiza atualizado_em automaticamente em qualquer UPDATE
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_atualizado_em ON leads;
CREATE TRIGGER trg_leads_atualizado_em
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
