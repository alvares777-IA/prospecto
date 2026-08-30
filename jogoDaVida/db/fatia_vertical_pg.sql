-- =====================================================================
--  Fatia vertical — tradução para PostgreSQL (banco `jogodavida`)
--  Só a base: identidade + topologia + avatar + era.
--  SEM motor de destino ainda (evento, regra_destino, saldo, limiar,
--  consequencia, pkg_destino) — ver docs/primeira_entrega.md §1.
--
--  Fonte: db/destino_fatia_vertical.sql (Oracle). Diferenças conscientes:
--   - steam_id  -> identificador (nome digitado; sem Steam no protótipo web) [§2]
--   - avatar_codigo em `jogador` (a pessoa é reconhecível entre vidas) [§3]
--   - `cena_unity` removido: protótipo 2D web, salas são <div>. Volta na
--     migração 3D, se acontecer.
--   - CHAR(1) 'S'/'N' mantido (padrão do schema); TIMESTAMPTZ + now().
--
--  Aplicar:
--    docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida \
--      < jogoDaVida/db/fatia_vertical_pg.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Era: existe desde já, com uma linha só. Tela de escolha só quando
-- houver uma segunda era para escolher. [§1]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS era (
  codigo      VARCHAR(30)  PRIMARY KEY,
  nome        VARCHAR(80)  NOT NULL,
  descricao   VARCHAR(400),
  disponivel  CHAR(1)      NOT NULL DEFAULT 'N' CHECK (disponivel IN ('S','N'))
);

-- ---------------------------------------------------------------------
-- Avatar: função, não enfeite — o recibo vai citar "aquela figura". [§3]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avatar (
  codigo   VARCHAR(30)   PRIMARY KEY,
  nome     VARCHAR(60)   NOT NULL,
  arquivo  VARCHAR(120)  NOT NULL,   -- caminho da imagem servida de public/
  ativo    CHAR(1)       NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N'))
);

-- ---------------------------------------------------------------------
-- Identidade
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jogador (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identificador  VARCHAR(64)  NOT NULL UNIQUE,
  apelido        VARCHAR(64)  NOT NULL,
  avatar_codigo  VARCHAR(30)  REFERENCES avatar(codigo),
  dt_criacao     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Topologia
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zona (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(30)  NOT NULL UNIQUE,
  nome        VARCHAR(80)  NOT NULL,
  capacidade  SMALLINT     NOT NULL DEFAULT 4,
  era_codigo  VARCHAR(30)  REFERENCES era(codigo)
);

-- Instância viva de uma zona. Um processo de servidor = uma sessão.
CREATE TABLE IF NOT EXISTS sessao (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zona_id         BIGINT        NOT NULL REFERENCES zona(id),
  servidor_host   VARCHAR(120)  NOT NULL,
  dt_abertura     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  dt_encerramento TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_sessao_abertas ON sessao (zona_id, dt_encerramento);

CREATE TABLE IF NOT EXISTS presenca (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id   BIGINT       NOT NULL REFERENCES sessao(id),
  jogador_id  BIGINT       NOT NULL REFERENCES jogador(id),
  dt_entrada  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  dt_saida    TIMESTAMPTZ,
  CONSTRAINT uk_presenca UNIQUE (sessao_id, jogador_id, dt_entrada)
);

-- =====================================================================
--  Seed da fatia
-- =====================================================================
INSERT INTO era (codigo, nome, descricao, disponivel) VALUES
  ('ATUAL', 'Era atual', 'O mundo como ele é, ou como parece ser.', 'S')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO avatar (codigo, nome, arquivo, ativo) VALUES
  ('A01', 'Círculo',   '/img/av01.svg', 'S'),
  ('A02', 'Quadrado',  '/img/av02.svg', 'S'),
  ('A03', 'Triângulo', '/img/av03.svg', 'S'),
  ('A04', 'Losango',   '/img/av04.svg', 'S')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO zona (codigo, nome, era_codigo) VALUES
  ('SALA_A', 'Átrio', 'ATUAL'),
  ('SALA_B', 'Anexo', 'ATUAL')
ON CONFLICT (codigo) DO NOTHING;
