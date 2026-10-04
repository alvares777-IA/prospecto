-- =====================================================================
--  jogoDaVida — esquema PostgreSQL (banco `jogodavida`)
--  Servidor-autoritativo | event sourcing | regras em tabela.
--
--  Traduzido do desenho original. Princípios preservados:
--   1. EVENTO é fato bruto e imutável. Nunca se corrige, só se compensa.
--   2. DESTINO_LANCAMENTO é razão (ledger). DESTINO_SALDO é cache derivado.
--   3. Regras vivem em tabela. Balanceamento = UPDATE, sem deploy.
--   4. CONSEQUENCIA é outbox. O servidor consome, não adivinha.
--
--  Aplicar:
--    docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida \
--      < jogoDaVida/db/schema_pg.sql
--  Idempotente: pode rodar de novo sem quebrar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IDENTIDADE E TOPOLOGIA
-- ---------------------------------------------------------------------

-- `identificador` é a chave estável da conta:
--   e-mail (login por senha) | 'google:'<sub> | 'anon:'<uuid> (efêmero).
-- Anônimo é gravado enquanto joga e APAGADO quando sai (docs: "perde tudo").
CREATE TABLE IF NOT EXISTS jogador (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identificador  VARCHAR(120) NOT NULL UNIQUE,
  apelido        VARCHAR(64)  NOT NULL,
  avatar_codigo  VARCHAR(30),
  anonimo        CHAR(1)      NOT NULL DEFAULT 'S' CHECK (anonimo IN ('S','N')),
  email          VARCHAR(120) UNIQUE,
  senha_hash     VARCHAR(255),
  google_id      VARCHAR(64)  UNIQUE,
  dt_criacao     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Store de sessão HTTP (connect-pg-simple) para contas com login.
CREATE TABLE IF NOT EXISTS sessoes (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_expire ON sessoes (expire);

CREATE TABLE IF NOT EXISTS era (
  codigo      VARCHAR(30)  PRIMARY KEY,
  nome        VARCHAR(80)  NOT NULL,
  descricao   VARCHAR(400),
  disponivel  CHAR(1)      NOT NULL DEFAULT 'N' CHECK (disponivel IN ('S','N'))
);

CREATE TABLE IF NOT EXISTS avatar (
  codigo   VARCHAR(30)   PRIMARY KEY,
  nome     VARCHAR(60)   NOT NULL,
  arquivo  VARCHAR(120)  NOT NULL,
  ativo    CHAR(1)       NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N'))
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'jogador_avatar_fk') THEN
    ALTER TABLE jogador
      ADD CONSTRAINT jogador_avatar_fk FOREIGN KEY (avatar_codigo) REFERENCES avatar(codigo);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS zona (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(30)  NOT NULL UNIQUE,
  nome        VARCHAR(80)  NOT NULL,
  capacidade  SMALLINT     NOT NULL DEFAULT 4,
  era_codigo  VARCHAR(30)  REFERENCES era(codigo)
);

-- Instância viva de uma zona. Uma sala criada por um jogador = uma sessão,
-- identificada por um código curto compartilhável (link).
CREATE TABLE IF NOT EXISTS sessao (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo          VARCHAR(12)   UNIQUE,
  zona_id         BIGINT        NOT NULL REFERENCES zona(id),
  servidor_host   VARCHAR(120)  NOT NULL,
  -- se o criador for um anônimo e ele sair, a sala continua (criador -> NULL)
  criador_id      BIGINT        REFERENCES jogador(id) ON DELETE SET NULL,
  estado          VARCHAR(16)   NOT NULL DEFAULT 'aguardando'
                  CHECK (estado IN ('aguardando','em_jogo','encerrada')),
  dt_abertura     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  dt_encerramento TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_sessao_abertas ON sessao (zona_id, dt_encerramento);

CREATE TABLE IF NOT EXISTS presenca (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id   BIGINT       NOT NULL REFERENCES sessao(id),
  -- anônimo "perde tudo ao sair": apagar o jogador leva junto as presenças
  jogador_id  BIGINT       NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  dt_entrada  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  dt_saida    TIMESTAMPTZ,
  CONSTRAINT uk_presenca UNIQUE (sessao_id, jogador_id, dt_entrada)
);


-- ---------------------------------------------------------------------
-- 2. LOG DE EVENTOS (append-only, alto volume)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_evento (
  codigo     VARCHAR(40) PRIMARY KEY,
  descricao  VARCHAR(200) NOT NULL,
  ativo      CHAR(1) NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N'))
);

CREATE TABLE IF NOT EXISTS evento (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- idempotência: o servidor gera o UUID. Retry de rede não duplica.
  evento_uid    UUID          NOT NULL UNIQUE,
  sessao_id     BIGINT        NOT NULL REFERENCES sessao(id),
  tipo_evento   VARCHAR(40)   NOT NULL REFERENCES tipo_evento(codigo),
  ator_id       BIGINT        NOT NULL REFERENCES jogador(id),
  alvo_id       BIGINT        REFERENCES jogador(id),
  valor         NUMERIC,
  contexto      JSONB,
  dt_evento     TIMESTAMPTZ   NOT NULL,   -- relógio do SERVIDOR, não do cliente
  dt_ingestao   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ck_evento_alvo CHECK (alvo_id IS NULL OR alvo_id <> ator_id)
);
CREATE INDEX IF NOT EXISTS ix_evento_janela ON evento (ator_id, tipo_evento, dt_evento DESC);
CREATE INDEX IF NOT EXISTS ix_evento_sessao ON evento (sessao_id, dt_evento);


-- ---------------------------------------------------------------------
-- 3. MOTOR DE REGRAS (o coração configurável)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS eixo_destino (
  codigo      VARCHAR(30) PRIMARY KEY,
  nome        VARCHAR(80) NOT NULL,
  pontos_min  INTEGER DEFAULT -1000 NOT NULL,
  pontos_max  INTEGER DEFAULT  1000 NOT NULL
);

CREATE TABLE IF NOT EXISTS regra_destino (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo               VARCHAR(40)  NOT NULL UNIQUE,
  eixo                 VARCHAR(30)  NOT NULL REFERENCES eixo_destino(codigo),
  tipo_evento          VARCHAR(40)  NOT NULL REFERENCES tipo_evento(codigo),
  peso                 INTEGER      NOT NULL,   -- pontos por ocorrência (+/-)
  -- anti-farm: 4 jogadores em loop cooperativo quebram qualquer economia
  janela_seg           INTEGER      NOT NULL DEFAULT 3600,
  max_ocorrencias      INTEGER      NOT NULL DEFAULT 5,
  exige_alvo_distinto  CHAR(1)      NOT NULL DEFAULT 'S' CHECK (exige_alvo_distinto IN ('S','N')),
  -- aleatoriedade: 1.0 = sempre aplica; 0.25 = aplica em 25% das vezes
  probabilidade        NUMERIC(5,4) NOT NULL DEFAULT 1 CHECK (probabilidade BETWEEN 0 AND 1),
  vigencia_ini         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  vigencia_fim         TIMESTAMPTZ,
  ativo                CHAR(1)      NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N'))
);
CREATE INDEX IF NOT EXISTS ix_regra_disparo ON regra_destino (tipo_evento, ativo);


-- ---------------------------------------------------------------------
-- 4. RAZÃO E SALDO
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS destino_lancamento (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id   BIGINT       NOT NULL REFERENCES jogador(id),
  eixo         VARCHAR(30)  NOT NULL REFERENCES eixo_destino(codigo),
  regra_id     BIGINT       NOT NULL REFERENCES regra_destino(id),
  evento_id    BIGINT       NOT NULL REFERENCES evento(id),
  pontos       INTEGER      NOT NULL,   -- 0 quando a regra rolou e não passou
  roll         NUMERIC(5,4),            -- o dado que foi jogado. AUDITÁVEL.
  dt_lancto    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uk_lancto UNIQUE (evento_id, regra_id)   -- reprocesso não duplica
);
CREATE INDEX IF NOT EXISTS ix_lancto_janela ON destino_lancamento (jogador_id, regra_id, dt_lancto DESC);

-- Cache derivado. Reconstruível a qualquer momento a partir do ledger.
CREATE TABLE IF NOT EXISTS destino_saldo (
  jogador_id  BIGINT       NOT NULL REFERENCES jogador(id),
  eixo        VARCHAR(30)  NOT NULL REFERENCES eixo_destino(codigo),
  pontos      INTEGER      NOT NULL DEFAULT 0,
  dt_atualiz  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_destino_saldo PRIMARY KEY (jogador_id, eixo)
);


-- ---------------------------------------------------------------------
-- 5. LIMIARES E CONSEQUÊNCIAS
-- ---------------------------------------------------------------------

-- Histerese: entra em 100, só sai em 80. Evita o mundo piscando na fronteira.
CREATE TABLE IF NOT EXISTS limiar (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  eixo            VARCHAR(30)  NOT NULL REFERENCES eixo_destino(codigo),
  codigo          VARCHAR(40)  NOT NULL UNIQUE,
  ordem           SMALLINT     NOT NULL,
  pontos_entrada  INTEGER      NOT NULL,
  pontos_saida    INTEGER      NOT NULL,
  efeito_codigo   VARCHAR(40)  NOT NULL,  -- o cliente mapeia isto para o que vê
  descricao       VARCHAR(200),
  CONSTRAINT ck_histerese CHECK (pontos_saida <= pontos_entrada)
);

CREATE TABLE IF NOT EXISTS estado_limiar (
  jogador_id  BIGINT       NOT NULL REFERENCES jogador(id),
  eixo        VARCHAR(30)  NOT NULL REFERENCES eixo_destino(codigo),
  limiar_id   BIGINT       REFERENCES limiar(id),
  dt_entrada  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_estado_limiar PRIMARY KEY (jogador_id, eixo)
);

-- OUTBOX. O banco não chama o jogo; o jogo consome o que o banco decidiu.
CREATE TABLE IF NOT EXISTS consequencia (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id     BIGINT        NOT NULL REFERENCES jogador(id),
  sessao_id      BIGINT        REFERENCES sessao(id),
  efeito_codigo  VARCHAR(40)   NOT NULL,
  payload        JSONB,
  dt_criacao     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  dt_entrega     TIMESTAMPTZ,
  tentativas     SMALLINT      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_conseq_pendente ON consequencia (sessao_id) WHERE dt_entrega IS NULL;


-- ---------------------------------------------------------------------
-- 6. PROTÓTIPO DE JOGO — enigmas, energia, portas, ajuda
--    Loop simples para testar jogabilidade. Vai virar enigmas reais.
-- ---------------------------------------------------------------------

-- Catálogo de enigmas. Cada um pode sobrepor parâmetros (ver `parametro`).
--   tipo 'texto'  -> pergunta + resposta, resolvido no campo do jogo
--   tipo 'html'   -> página interativa em public/enigmas/<arquivo>; a página
--                    valida e avisa o jogo por postMessage (resposta = data-answer)
-- Carregados por db/importar_enigmas.mjs a partir de db/enigmas/.
CREATE TABLE IF NOT EXISTS enigma (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origem    VARCHAR(80)  UNIQUE,             -- chave estável de importação ('csv:1', 'html:enigma-001')
  tipo      VARCHAR(20)  NOT NULL DEFAULT 'texto',
  nivel     VARCHAR(14),                     -- Fácil | Intermediário | Difícil
  ordem     INT,                             -- posição na sequência
  pergunta  TEXT         NOT NULL,
  resposta  VARCHAR(400) NOT NULL,           -- comparada com norm() (minúsculas, sem acento/pontuação)
  arquivo   VARCHAR(120),                    -- para tipo 'html': nome do .html em public/enigmas/
  ativo     CHAR(1)      NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N'))
);
CREATE INDEX IF NOT EXISTS ix_enigma_seq ON enigma (ativo, ordem, id);

-- Parâmetros em 3 escopos. Resolução: enigma -> sala (sessao) -> global.
-- Chaves: energia_inicial, decaimento_min, penalidade_erro, custo_ajudar,
--         custo_pedir_ajuda, penalidade_chat, chat_aberto, qtd_enigmas,
--         bonus_enigma, bonus_vitoria, piso_energia, doacao_energia, custo_desistir.
--         (`qtd_enigmas` = nº de portas SOLO; as fases co-op somam por cima.)
CREATE TABLE IF NOT EXISTS parametro (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escopo    VARCHAR(10) NOT NULL CHECK (escopo IN ('global','sala','enigma')),
  escopo_id BIGINT,                          -- NULL p/ global; sessao.id p/ sala; enigma.id p/ enigma
  chave     VARCHAR(40) NOT NULL,
  valor     NUMERIC     NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_parametro ON parametro (escopo, COALESCE(escopo_id, 0), chave);

-- A sequência de enigmas de uma sala (as "portas"). Gerada ao iniciar o jogo.
CREATE TABLE IF NOT EXISTS sessao_enigma (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id  BIGINT NOT NULL REFERENCES sessao(id) ON DELETE CASCADE,
  ordem      INT    NOT NULL,               -- 1..N = a porta
  enigma_id  BIGINT NOT NULL REFERENCES enigma(id),
  CONSTRAINT uk_sessao_enigma UNIQUE (sessao_id, ordem)
);

-- Progresso de cada jogador numa sala: energia e porta atual.
CREATE TABLE IF NOT EXISTS partida_jogador (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id   BIGINT  NOT NULL REFERENCES sessao(id) ON DELETE CASCADE,
  jogador_id  BIGINT  NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  energia     NUMERIC NOT NULL,             -- energia após o último evento
  dt_energia  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- quando 'energia' foi calculada
  porta       INT     NOT NULL DEFAULT 1,
  dt_inicio   TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_fim      TIMESTAMPTZ,                  -- concluiu tudo ou zerou energia
  CONSTRAINT uk_partida UNIQUE (sessao_id, jogador_id)
);

CREATE TABLE IF NOT EXISTS tentativa (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partida_id BIGINT  NOT NULL REFERENCES partida_jogador(id) ON DELETE CASCADE,
  porta      INT     NOT NULL,
  enigma_id  BIGINT  NOT NULL REFERENCES enigma(id),
  resposta   VARCHAR(120),
  correta    BOOLEAN NOT NULL,
  dt         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ajuda (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id       BIGINT NOT NULL REFERENCES sessao(id) ON DELETE CASCADE,
  de_jogador_id   BIGINT REFERENCES jogador(id) ON DELETE SET NULL,
  para_jogador_id BIGINT REFERENCES jogador(id) ON DELETE SET NULL,
  tipo            VARCHAR(10) NOT NULL
                  CHECK (tipo IN ('pedido','oferta','recusa','resposta')),
  porta           INT,
  dt              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Caráter do jogador: marcas de comportamento social observado no jogo.
CREATE TABLE IF NOT EXISTS carater (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id   BIGINT REFERENCES sessao(id) ON DELETE CASCADE,
  jogador_id  BIGINT REFERENCES jogador(id) ON DELETE CASCADE,
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('negativo','positivo')),
  descricao   VARCHAR(200) NOT NULL,
  porta       INT,
  dt          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
--  FUNÇÕES  (o motor de destino)
-- =====================================================================

-- Ajusta os limiares do jogador num eixo e enfileira a consequência.
CREATE OR REPLACE FUNCTION avaliar_limiares(p_jogador_id BIGINT, p_eixo VARCHAR)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_saldo  INTEGER;
  v_atual  BIGINT;
  v_novo   BIGINT;
  v_efeito VARCHAR(40);
BEGIN
  SELECT COALESCE(pontos,0) INTO v_saldo
    FROM destino_saldo WHERE jogador_id = p_jogador_id AND eixo = p_eixo;
  v_saldo := COALESCE(v_saldo, 0);

  SELECT limiar_id INTO v_atual
    FROM estado_limiar WHERE jogador_id = p_jogador_id AND eixo = p_eixo;

  -- Maior limiar (por ordem) cujo gatilho o saldo satisfaz, com histerese:
  -- para SUBIR precisa de pontos_entrada; para PERMANECER basta pontos_saida.
  SELECT id INTO v_novo
    FROM limiar
   WHERE eixo = p_eixo
     AND ( v_saldo >= pontos_entrada
           OR (id = v_atual AND v_saldo >= pontos_saida) )
   ORDER BY ordem DESC, id DESC
   LIMIT 1;

  IF COALESCE(v_novo, -1) <> COALESCE(v_atual, -1) THEN
    INSERT INTO estado_limiar (jogador_id, eixo, limiar_id)
    VALUES (p_jogador_id, p_eixo, v_novo)
    ON CONFLICT (jogador_id, eixo)
    DO UPDATE SET limiar_id = EXCLUDED.limiar_id, dt_entrada = now();

    SELECT efeito_codigo INTO v_efeito FROM limiar WHERE id = COALESCE(v_novo, v_atual);

    INSERT INTO consequencia (jogador_id, efeito_codigo, payload)
    VALUES (p_jogador_id,
            CASE WHEN v_novo IS NULL THEN v_efeito || '_OFF' ELSE v_efeito END,
            jsonb_build_object('saldo', v_saldo));
  END IF;
END $$;

-- Aplica todas as regras ativas do tipo do evento. Grava o dado (roll) sempre,
-- mesmo quando não pontua — regra oculta sem auditoria é indepurável.
CREATE OR REPLACE FUNCTION aplicar_regras(p_evento_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_ev      evento%ROWTYPE;
  r         regra_destino%ROWTYPE;
  v_ocorr   INTEGER;
  v_repet   INTEGER;
  v_roll    NUMERIC(5,4);
  v_pontos  INTEGER;
  v_inseriu BIGINT;
BEGIN
  SELECT * INTO v_ev FROM evento WHERE id = p_evento_id;

  FOR r IN
    SELECT * FROM regra_destino
     WHERE tipo_evento = v_ev.tipo_evento
       AND ativo = 'S'
       AND v_ev.dt_evento >= vigencia_ini
       AND (vigencia_fim IS NULL OR v_ev.dt_evento < vigencia_fim)
  LOOP
    -- teto de ocorrências na janela deslizante
    SELECT count(*) INTO v_ocorr
      FROM destino_lancamento
     WHERE jogador_id = v_ev.ator_id
       AND regra_id   = r.id
       AND pontos    <> 0
       AND dt_lancto  > now() - make_interval(secs => r.janela_seg);
    IF v_ocorr >= r.max_ocorrencias THEN
      CONTINUE;
    END IF;

    -- alvo repetido não pontua (mata o loop cooperativo A<->B)
    IF r.exige_alvo_distinto = 'S' AND v_ev.alvo_id IS NOT NULL THEN
      SELECT count(*) INTO v_repet
        FROM destino_lancamento kl
        JOIN evento e ON e.id = kl.evento_id
       WHERE kl.jogador_id = v_ev.ator_id
         AND kl.regra_id   = r.id
         AND kl.pontos    <> 0
         AND e.alvo_id     = v_ev.alvo_id
         AND kl.dt_lancto  > now() - make_interval(secs => r.janela_seg);
      IF v_repet > 0 THEN
        CONTINUE;
      END IF;
    END IF;

    -- o dado. random() ∈ [0,1). Guardado mesmo quando falha.
    v_roll   := random();
    v_pontos := CASE WHEN v_roll <= r.probabilidade THEN r.peso ELSE 0 END;

    INSERT INTO destino_lancamento (jogador_id, eixo, regra_id, evento_id, pontos, roll)
    VALUES (v_ev.ator_id, r.eixo, r.id, v_ev.id, v_pontos, v_roll)
    ON CONFLICT (evento_id, regra_id) DO NOTHING
    RETURNING id INTO v_inseriu;

    IF v_inseriu IS NULL THEN
      CONTINUE;   -- já lançado antes (reprocesso)
    END IF;

    IF v_pontos <> 0 THEN
      INSERT INTO destino_saldo (jogador_id, eixo, pontos)
      VALUES (v_ev.ator_id, r.eixo, v_pontos)
      ON CONFLICT (jogador_id, eixo)
      DO UPDATE SET pontos = destino_saldo.pontos + EXCLUDED.pontos, dt_atualiz = now();

      PERFORM avaliar_limiares(v_ev.ator_id, r.eixo);
    END IF;
  END LOOP;
END $$;

-- Chamado pelo servidor ao FIM de uma ação, nunca por frame. Idempotente por
-- evento_uid: retry de rede devolve o mesmo id sem reprocessar.
CREATE OR REPLACE FUNCTION registrar_evento(
  p_evento_uid   UUID,
  p_sessao_id    BIGINT,
  p_tipo_evento  VARCHAR,
  p_ator_id      BIGINT,
  p_alvo_id      BIGINT      DEFAULT NULL,
  p_valor        NUMERIC     DEFAULT NULL,
  p_contexto     JSONB       DEFAULT NULL,
  p_dt_evento    TIMESTAMPTZ DEFAULT now()
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_evento_id BIGINT;
BEGIN
  BEGIN
    INSERT INTO evento (evento_uid, sessao_id, tipo_evento, ator_id,
                        alvo_id, valor, contexto, dt_evento)
    VALUES (p_evento_uid, p_sessao_id, p_tipo_evento, p_ator_id,
            p_alvo_id, p_valor, p_contexto, p_dt_evento)
    RETURNING id INTO v_evento_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_evento_id FROM evento WHERE evento_uid = p_evento_uid;
    RETURN v_evento_id;   -- já registrado, não reprocessa
  END;

  PERFORM aplicar_regras(v_evento_id);
  RETURN v_evento_id;
END $$;

-- Outbox: devolve as pendentes da sessão E marca como entregues (não é GET).
CREATE OR REPLACE FUNCTION consumir_consequencias(p_sessao_id BIGINT)
RETURNS TABLE (id BIGINT, jogador_id BIGINT, identificador VARCHAR,
               efeito_codigo VARCHAR, payload JSONB)
LANGUAGE sql AS $$
  WITH pend AS (
    SELECT c.id
      FROM consequencia c
      JOIN presenca p ON p.jogador_id = c.jogador_id
                     AND p.sessao_id  = p_sessao_id
                     AND p.dt_saida IS NULL
     WHERE c.dt_entrega IS NULL
     FOR UPDATE OF c SKIP LOCKED
  ),
  upd AS (
    UPDATE consequencia c
       SET dt_entrega = now(), tentativas = tentativas + 1
      FROM pend
     WHERE c.id = pend.id
    RETURNING c.id, c.jogador_id, c.efeito_codigo, c.payload
  )
  SELECT u.id, u.jogador_id, j.identificador, u.efeito_codigo, u.payload
    FROM upd u JOIN jogador j ON j.id = u.jogador_id;
$$;

-- Reconstrói o saldo a partir do ledger (o ledger é a verdade).
CREATE OR REPLACE FUNCTION reconstruir_saldo(p_jogador_id BIGINT DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO destino_saldo (jogador_id, eixo, pontos)
  SELECT jogador_id, eixo, SUM(pontos)
    FROM destino_lancamento
   WHERE p_jogador_id IS NULL OR jogador_id = p_jogador_id
   GROUP BY jogador_id, eixo
  ON CONFLICT (jogador_id, eixo)
  DO UPDATE SET pontos = EXCLUDED.pontos, dt_atualiz = now();
$$;

-- Resolve um parâmetro do jogo: enigma -> sala (sessao) -> global.
CREATE OR REPLACE FUNCTION param(p_chave VARCHAR, p_enigma_id BIGINT, p_sessao_id BIGINT)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT valor FROM parametro
   WHERE chave = p_chave
     AND ( (escopo = 'enigma' AND escopo_id = p_enigma_id)
        OR (escopo = 'sala'   AND escopo_id = p_sessao_id)
        OR (escopo = 'global') )
   ORDER BY CASE escopo WHEN 'enigma' THEN 1 WHEN 'sala' THEN 2 ELSE 3 END
   LIMIT 1;
$$;

-- Energia atual de uma partida = energia registrada menos o decaimento
-- (parâmetro do enigma da porta atual) desde dt_energia. Nunca abaixo de 0.
CREATE OR REPLACE FUNCTION energia_atual(p_partida_id BIGINT)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0, pj.energia
           - COALESCE(param('decaimento_min', se.enigma_id, pj.sessao_id), 1)
             * (EXTRACT(EPOCH FROM now() - pj.dt_energia) / 60.0))
    FROM partida_jogador pj
    LEFT JOIN sessao_enigma se ON se.sessao_id = pj.sessao_id AND se.ordem = pj.porta
   WHERE pj.id = p_partida_id;
$$;


-- =====================================================================
--  SEED DA FATIA VERTICAL
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

INSERT INTO tipo_evento (codigo, descricao) VALUES
  ('AJUDA_REERGUER',   'Reergueu jogador caído'),
  ('PORTAL_ATRAVESSOU','Atravessou portal')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO eixo_destino (codigo, nome, pontos_min, pontos_max) VALUES
  ('SOLIDARIEDADE', 'Solidariedade', -500, 500)
ON CONFLICT (codigo) DO NOTHING;

-- A única regra da fatia.
INSERT INTO regra_destino (codigo, eixo, tipo_evento, peso, janela_seg,
                           max_ocorrencias, exige_alvo_distinto, probabilidade)
VALUES ('REERGUER_ALIADO', 'SOLIDARIEDADE', 'AJUDA_REERGUER', 10, 1800, 3, 'S', 1)
ON CONFLICT (codigo) DO NOTHING;

-- Um único limiar visível. Com histerese.
INSERT INTO limiar (eixo, codigo, ordem, pontos_entrada, pontos_saida, efeito_codigo, descricao)
VALUES ('SOLIDARIEDADE', 'SOLIDARIO_1', 1, 30, 20,
        'LUZ_QUENTE', 'A iluminação da sala muda de tom para o jogador')
ON CONFLICT (codigo) DO NOTHING;


-- ── Protótipo de jogo ───────────────────────────────────────────────

-- Parâmetros globais (o que o usuário definiu). Sala e enigma podem sobrepor.
INSERT INTO parametro (escopo, escopo_id, chave, valor) VALUES
  ('global', NULL, 'energia_inicial',   100),
  ('global', NULL, 'decaimento_min',      1),   -- % de energia por minuto
  ('global', NULL, 'penalidade_erro',     5),   -- % por resposta errada
  ('global', NULL, 'custo_ajudar',        5),   -- % de quem dá a resposta
  ('global', NULL, 'custo_pedir_ajuda',   2),   -- % de quem pede ajuda
  ('global', NULL, 'penalidade_chat',    10),   -- % de TODOS se a resposta cair no chat
  ('global', NULL, 'chat_aberto',         0),   -- 0 = chat fechado (abre ao oferecerem ajuda); 1 = sempre aberto
  ('global', NULL, 'qtd_enigmas',         4)    -- portas por sala
ON CONFLICT (escopo, COALESCE(escopo_id, 0), chave) DO NOTHING;


-- =====================================================================
--  7. ENERGIA PESSOAL + FASE CO-OP + DOAÇÃO + DESISTIR
--  Migração incremental e idempotente.
-- =====================================================================

-- Energia pessoal: sobrevive entre salas. Não decai no tempo — só volta
-- como prêmio (bonus_enigma ao resolver, bonus_vitoria ao vencer).
-- Anônimo não persiste (a linha é apagada ao sair); entra sempre com 100.
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS energia NUMERIC NOT NULL DEFAULT 100;

-- FASE CO-OP é atributo do CATÁLOGO: enigmas com a mesma `fase` (número)
-- formam um trecho resolvido coletivamente dentro da sequência individual.
ALTER TABLE enigma ADD COLUMN IF NOT EXISTS fase INT;

-- Slot da sequência da sala: `fase` (NULL = porta solo) e resolução coletiva.
ALTER TABLE sessao_enigma ADD COLUMN IF NOT EXISTS fase          INT;
ALTER TABLE sessao_enigma ADD COLUMN IF NOT EXISTS resolvido_por BIGINT REFERENCES jogador(id) ON DELETE SET NULL;
ALTER TABLE sessao_enigma ADD COLUMN IF NOT EXISTS dt_resolvido  TIMESTAMPTZ;

-- Tentativa serve também as fases (sem partida por porta): partida_id
-- opcional; amarra em sessao/jogador/ordem.
ALTER TABLE tentativa ALTER COLUMN partida_id DROP NOT NULL;
ALTER TABLE tentativa ADD COLUMN IF NOT EXISTS sessao_id  BIGINT REFERENCES sessao(id) ON DELETE CASCADE;
ALTER TABLE tentativa ADD COLUMN IF NOT EXISTS jogador_id BIGINT REFERENCES jogador(id) ON DELETE CASCADE;
ALTER TABLE tentativa ADD COLUMN IF NOT EXISTS ordem      INT;

-- Desfaz o desenho abandonado de "modo de sala" (barra de energia da equipe).
-- Energia agora é sempre PESSOAL. Idempotente.
DROP TABLE IF EXISTS partida_equipe;
ALTER TABLE partida_jogador DROP COLUMN IF EXISTS energia_entrada;
ALTER TABLE sessao          DROP COLUMN IF EXISTS fase_atual;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessao_modo_chk') THEN
    ALTER TABLE sessao DROP CONSTRAINT sessao_modo_chk;
  END IF;
END $$;
ALTER TABLE sessao DROP COLUMN IF EXISTS modo;
DELETE FROM parametro WHERE escopo = 'global' AND chave IN ('qtd_fases', 'enigmas_por_fase');

-- Doação de energia entre jogadores. Qualquer um pode doar a qualquer outro,
-- na porta ou na fase; vários podem doar. Doador perde `doacao_energia` % e
-- o alvo ganha o mesmo (limitado pelo teto de 100 e pela energia do doador).
-- Doar deixa marca de caráter positiva. Pode DESTRAVAR quem esgotou sem concluir.
CREATE TABLE IF NOT EXISTS doacao (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id       BIGINT NOT NULL REFERENCES sessao(id) ON DELETE CASCADE,
  de_jogador_id   BIGINT REFERENCES jogador(id) ON DELETE SET NULL,
  para_jogador_id BIGINT REFERENCES jogador(id) ON DELETE SET NULL,
  valor           NUMERIC NOT NULL,
  porta           INT,
  dt              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Desistir de um enigma: o jogo revela a resposta por `custo_desistir` % da
-- energia pessoal. `orgulho` = havia outro jogador à frente (já passou da
-- fase) e mesmo assim preferiu pedir ao jogo -> marca de caráter negativa.
CREATE TABLE IF NOT EXISTS desistencia (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id  BIGINT NOT NULL REFERENCES sessao(id) ON DELETE CASCADE,
  jogador_id BIGINT REFERENCES jogador(id) ON DELETE SET NULL,
  enigma_id  BIGINT REFERENCES enigma(id),
  ordem      INT,
  custo      NUMERIC NOT NULL,
  orgulho    BOOLEAN NOT NULL DEFAULT false,
  porta      INT,
  dt         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parâmetros novos (globais; sala/enigma podem sobrepor).
INSERT INTO parametro (escopo, escopo_id, chave, valor) VALUES
  ('global', NULL, 'bonus_enigma',     3),   -- % que volta ao resolver um enigma
  ('global', NULL, 'bonus_vitoria',   10),   -- % que volta ao vencer a sala
  ('global', NULL, 'piso_energia',     0),   -- energia mínima ao entrar numa partida (0 = honra o "afundou")
  ('global', NULL, 'doacao_energia',  10),   -- % transferido por doação de energia
  ('global', NULL, 'custo_desistir',  20)    -- % pago para o jogo revelar a resposta
ON CONFLICT (escopo, COALESCE(escopo_id, 0), chave) DO NOTHING;



-- =====================================================================
--  MUNDO — porta multiplayer 2D (tipo 'mundo'). Estado vivo no Node
--  (server/mundo.js); aqui só catálogo, parâmetros e o motor de destino.
--  Os ATOS (doar, saquear, pacto...) vão para `evento` via
--  registrar_evento e para `carater`. Pesos ficam em regra_destino.
-- =====================================================================

INSERT INTO tipo_evento (codigo, descricao) VALUES
  ('DOOU_ITEM',       'Doou item do próprio inventário a outro jogador'),
  ('ALIMENTOU',       'Deu comida a jogador desmaiado de fome'),
  ('DEPOSITOU_BAU',   'Depositou itens no baú da equipe'),
  ('SAQUEOU_BAU',     'Sacou do baú da equipe além do que tinha depositado'),
  ('ROUBOU_BLOCO',    'Tomou o bloco que outro jogador estava minerando'),
  ('PEDIU_SOCORRO',   'Pediu socorro'),
  ('RECUSOU',         'Recusou um pedido de socorro'),
  ('IGNOROU',         'Deixou um pedido de socorro sem resposta até o prazo'),
  ('ACEITOU_PACTO',   'Aceitou um pedido de socorro'),
  ('CUMPRIU_PACTO',   'Aceitou o socorro e ajudou'),
  ('TENTOU_CUMPRIR',  'Aceitou o socorro, foi em direção, não chegou a tempo'),
  ('ROMPEU_PACTO',    'Aceitou o socorro e não se moveu'),
  ('PROTEGEU_ALIADO', 'Derrubou um adversário que atacava outro jogador')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO eixo_destino (codigo, nome, pontos_min, pontos_max) VALUES
  ('GENEROSIDADE',   'Generosidade',   -500, 500),
  ('CONFIABILIDADE', 'Confiabilidade', -500, 500)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO regra_destino (codigo, eixo, tipo_evento, peso, janela_seg,
                           max_ocorrencias, exige_alvo_distinto, probabilidade) VALUES
  ('DOAR_ITEM',        'GENEROSIDADE',   'DOOU_ITEM',       5, 1800, 4, 'S', 1),
  ('ALIMENTAR',        'SOLIDARIEDADE',  'ALIMENTOU',       8, 1800, 3, 'S', 1),
  ('DEPOSITAR_BAU',    'GENEROSIDADE',   'DEPOSITOU_BAU',   2, 1800, 5, 'N', 1),
  ('SAQUEAR_BAU',      'GENEROSIDADE',   'SAQUEOU_BAU',    -6, 1800, 5, 'N', 1),
  ('ROUBAR_BLOCO',     'GENEROSIDADE',   'ROUBOU_BLOCO',   -4, 1800, 5, 'N', 0.7),
  ('RECUSAR_SOCORRO',  'CONFIABILIDADE', 'RECUSOU',        -2, 1800, 5, 'N', 1),
  ('IGNORAR_SOCORRO',  'CONFIABILIDADE', 'IGNOROU',        -4, 1800, 5, 'N', 1),
  ('CUMPRIR_PACTO',    'CONFIABILIDADE', 'CUMPRIU_PACTO',  10, 1800, 3, 'S', 1),
  ('TENTAR_CUMPRIR',   'CONFIABILIDADE', 'TENTOU_CUMPRIR',  4, 1800, 3, 'S', 1),
  ('ROMPER_PACTO',     'CONFIABILIDADE', 'ROMPEU_PACTO',  -15, 3600, 5, 'N', 1),
  ('PROTEGER_ALIADO',  'SOLIDARIEDADE',  'PROTEGEU_ALIADO',  7, 1800, 4, 'S', 1)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO parametro (escopo, escopo_id, chave, valor) VALUES
  ('global', NULL, 'mundo_duracao_seg',       240),  -- tempo pessoal dentro do mundo
  ('global', NULL, 'mundo_meta_equipe',       120),  -- pontos no baú que fazem TODOS passarem
  ('global', NULL, 'mundo_fome_seg',            3),  -- segundos por ponto de fome perdido (0-100)
  ('global', NULL, 'mundo_socorro_prazo_seg',  30),  -- prazo do pedido de socorro
  ('global', NULL, 'mundo_valor_minerio',       5),
  ('global', NULL, 'mundo_valor_comida',        2),
  ('global', NULL, 'mundo_valor_madeira',       1),
  ('global', NULL, 'mundo_valor_pedra',         1),
  ('global', NULL, 'mundo_vida_jogador',       10),  -- vida máxima do jogador
  ('global', NULL, 'mundo_mob_vida_pct',      100),  -- vida dos adversários (% do base: zumbi 4, esqueleto 3, soldado 6)
  ('global', NULL, 'mundo_mob_vel_pct',       100),  -- velocidade dos adversários (% do base; 200 = o dobro)
  ('global', NULL, 'mundo_mob_dano_pct',      100),  -- dano dos adversários (% do base: 1, 1 e 2)
  ('global', NULL, 'mundo_mob_qtd',             9),  -- adversários ao abrir o mundo
  ('global', NULL, 'mundo_mob_max',            12)   -- teto de adversários (nascem 1 a cada 25s)
ON CONFLICT (escopo, COALESCE(escopo_id, 0), chave) DO NOTHING;

-- A porta do mundo no catálogo. resposta = meta PESSOAL de pontos.
INSERT INTO enigma (origem, tipo, nivel, ordem, pergunta, resposta, ativo)
VALUES ('mundo:1', 'mundo', 'Mundo', 3,
        'Mundo: colete recursos. Meta pessoal de pontos, ou o baú da equipe cheio.', '30', 'S')
ON CONFLICT (origem) DO NOTHING;

-- Jogos arcade: energia por ação especial (% ; enigma pode sobrepor).
INSERT INTO parametro (escopo, escopo_id, chave, valor) VALUES
  ('global', NULL, 'custo_tiro',       1),   -- Paddle: cada tiro (seta p/ cima)
  ('global', NULL, 'custo_grudar',     5),   -- Paddle: bola de volta na raquete (seta p/ baixo)
  ('global', NULL, 'ganho_fruta',      5),   -- Cobrinha: cada fruta comida
  ('global', NULL, 'custo_escudo',     5),   -- Invasores: escudo de 5s (seta p/ baixo)
  ('global', NULL, 'teto_ganho_jogo', 30)    -- máximo que um jogo pode DAR de energia por porta
ON CONFLICT (escopo, COALESCE(escopo_id, 0), chave) DO NOTHING;

-- Jogos (tipo 'jogo'): quantas fases/níveis o jogo tem dentro dele (1 = só a
-- primeira). Chama-se `niveis` para não confundir com `fase` (trecho co-op).
ALTER TABLE enigma ADD COLUMN IF NOT EXISTS niveis INT NOT NULL DEFAULT 1 CHECK (niveis >= 1);
