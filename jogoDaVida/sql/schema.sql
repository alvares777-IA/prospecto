-- Schema do jogoDaVida — database `jogodavida`.
-- Todas as tabelas usam o prefixo jv_ para conviver com outros serviços no mesmo Postgres.
-- Aplicar manualmente com:
--   docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida < jogoDaVida/sql/schema.sql
-- (O src/db.js roda o mesmo DDL no boot, de forma idempotente.)

CREATE TABLE IF NOT EXISTS jv_usuarios (
    id         SERIAL       PRIMARY KEY,
    nome       VARCHAR(120) NOT NULL,
    email      VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil     VARCHAR(20)  NOT NULL DEFAULT 'jogador' CHECK (perfil IN ('admin', 'jogador')),
    ativo      BOOLEAN      NOT NULL DEFAULT true,
    criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Store de sessão do express-session (connect-pg-simple), renomeada com o prefixo jv_.
CREATE TABLE IF NOT EXISTS jv_sessoes (
    sid    VARCHAR     NOT NULL PRIMARY KEY,
    sess   JSON        NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jv_sessoes_expire ON jv_sessoes (expire);
