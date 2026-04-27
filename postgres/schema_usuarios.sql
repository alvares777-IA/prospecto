-- Tabelas de autenticação do leads-app
-- Aplicar com: docker exec -i prospecto-postgres-1 psql -U prospecto -d leads < postgres/schema_usuarios.sql

CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL      PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(120) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    perfil      VARCHAR(20)  NOT NULL CHECK (perfil IN ('admin', 'supervisor', 'operador')),
    ativo       BOOLEAN      NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessoes (
    sid     VARCHAR      NOT NULL PRIMARY KEY,
    sess    JSON         NOT NULL,
    expire  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_expire ON sessoes (expire);
