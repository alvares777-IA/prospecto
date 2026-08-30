-- =====================================================================
--  FATIA VERTICAL - 2 salas, 4 jogadores, 1 regra de destino
--  Oracle 19c+  |  servidor-autoritativo  |  event sourcing
-- =====================================================================
--  Principios:
--   1. EVENTO e' fato bruto e imutavel. Nunca se corrige, so se compensa.
--   2. DESTINO_LANCAMENTO e' razao (ledger). DESTINO_SALDO e' cache derivado.
--   3. Regras vivem em tabela. Balanceamento = UPDATE, sem patch na Steam.
--   4. CONSEQUENCIA e' outbox. O servidor de zona consome, nao adivinha.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. IDENTIDADE E TOPOLOGIA
-- ---------------------------------------------------------------------

CREATE TABLE jogador (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  steam_id     VARCHAR2(20)  NOT NULL UNIQUE,
  apelido      VARCHAR2(64)  NOT NULL,
  dt_criacao   TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE zona (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       VARCHAR2(30)  NOT NULL UNIQUE,
  nome         VARCHAR2(80)  NOT NULL,
  cena_unity   VARCHAR2(80)  NOT NULL,   -- nome da Scene no build
  capacidade   NUMBER(3)     DEFAULT 4 NOT NULL
);

-- Instancia viva de uma zona. Um processo de servidor dedicado = uma sessao.
CREATE TABLE sessao (
  id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zona_id        NUMBER        NOT NULL REFERENCES zona(id),
  servidor_host  VARCHAR2(120) NOT NULL,
  dt_abertura    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  dt_encerramento TIMESTAMP
);
CREATE INDEX ix_sessao_abertas ON sessao (zona_id, dt_encerramento);

CREATE TABLE presenca (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sessao_id    NUMBER    NOT NULL REFERENCES sessao(id),
  jogador_id   NUMBER    NOT NULL REFERENCES jogador(id),
  dt_entrada   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  dt_saida     TIMESTAMP,
  CONSTRAINT uk_presenca UNIQUE (sessao_id, jogador_id, dt_entrada)
);


-- ---------------------------------------------------------------------
-- 2. LOG DE EVENTOS  (append-only, alto volume, candidato a particionar)
-- ---------------------------------------------------------------------

CREATE TABLE tipo_evento (
  codigo       VARCHAR2(40) PRIMARY KEY,
  descricao    VARCHAR2(200) NOT NULL,
  ativo        CHAR(1) DEFAULT 'S' NOT NULL CHECK (ativo IN ('S','N'))
);

CREATE TABLE evento (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- idempotencia: o servidor de zona gera o GUID. Retry de rede nao duplica.
  evento_uid    RAW(16)       NOT NULL UNIQUE,
  sessao_id     NUMBER        NOT NULL REFERENCES sessao(id),
  tipo_evento   VARCHAR2(40)  NOT NULL REFERENCES tipo_evento(codigo),
  ator_id       NUMBER        NOT NULL REFERENCES jogador(id),
  alvo_id       NUMBER        REFERENCES jogador(id),
  valor         NUMBER,                       -- magnitude (hp curado, dano, etc)
  contexto      CLOB,                         -- payload livre do gameplay
  dt_evento     TIMESTAMP     NOT NULL,       -- relogio do SERVIDOR, nao do cliente
  dt_ingestao   TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT ck_evento_json CHECK (contexto IS JSON),
  CONSTRAINT ck_evento_alvo CHECK (alvo_id IS NULL OR alvo_id <> ator_id)
);

-- Indice que sustenta as consultas de janela deslizante das regras.
CREATE INDEX ix_evento_janela ON evento (ator_id, tipo_evento, dt_evento DESC);
CREATE INDEX ix_evento_sessao ON evento (sessao_id, dt_evento);


-- ---------------------------------------------------------------------
-- 3. MOTOR DE REGRAS  (o coracao configuravel)
-- ---------------------------------------------------------------------

CREATE TABLE eixo_destino (
  codigo       VARCHAR2(30) PRIMARY KEY,
  nome         VARCHAR2(80) NOT NULL,
  pontos_min   NUMBER(10) DEFAULT -1000 NOT NULL,
  pontos_max   NUMBER(10) DEFAULT  1000 NOT NULL
);

CREATE TABLE regra_destino (
  id                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                VARCHAR2(40)  NOT NULL UNIQUE,
  eixo                  VARCHAR2(30)  NOT NULL REFERENCES eixo_destino(codigo),
  tipo_evento           VARCHAR2(40)  NOT NULL REFERENCES tipo_evento(codigo),
  peso                  NUMBER(6)     NOT NULL,   -- pontos por ocorrencia (+/-)
  -- ---- anti-farm: 4 jogadores em loop cooperativo quebram qualquer economia
  janela_seg            NUMBER(8)     DEFAULT 3600 NOT NULL,
  max_ocorrencias       NUMBER(4)     DEFAULT 5    NOT NULL,
  exige_alvo_distinto   CHAR(1)       DEFAULT 'S'  NOT NULL
                        CHECK (exige_alvo_distinto IN ('S','N')),
  -- ---- aleatoriedade: 1.0 = sempre aplica; 0.25 = aplica em 25% das vezes
  probabilidade         NUMBER(5,4)   DEFAULT 1 NOT NULL
                        CHECK (probabilidade BETWEEN 0 AND 1),
  vigencia_ini          TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  vigencia_fim          TIMESTAMP,
  ativo                 CHAR(1)       DEFAULT 'S' NOT NULL CHECK (ativo IN ('S','N'))
);
CREATE INDEX ix_regra_disparo ON regra_destino (tipo_evento, ativo);


-- ---------------------------------------------------------------------
-- 4. RAZAO E SALDO
-- ---------------------------------------------------------------------

CREATE TABLE destino_lancamento (
  id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id   NUMBER       NOT NULL REFERENCES jogador(id),
  eixo         VARCHAR2(30) NOT NULL REFERENCES eixo_destino(codigo),
  regra_id     NUMBER       NOT NULL REFERENCES regra_destino(id),
  evento_id    NUMBER       NOT NULL REFERENCES evento(id),
  pontos       NUMBER(6)    NOT NULL,   -- 0 quando a regra rolou e nao passou
  roll         NUMBER(5,4),             -- o dado que foi jogado. AUDITAVEL.
  dt_lancto    TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uk_lancto UNIQUE (evento_id, regra_id)  -- reprocesso nao duplica
);
CREATE INDEX ix_lancto_janela ON destino_lancamento (jogador_id, regra_id, dt_lancto DESC);

-- Cache derivado. Reconstruivel a qualquer momento a partir do ledger.
CREATE TABLE destino_saldo (
  jogador_id   NUMBER       NOT NULL REFERENCES jogador(id),
  eixo         VARCHAR2(30) NOT NULL REFERENCES eixo_destino(codigo),
  pontos       NUMBER(10)   DEFAULT 0 NOT NULL,
  dt_atualiz   TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_destino_saldo PRIMARY KEY (jogador_id, eixo)
);


-- ---------------------------------------------------------------------
-- 5. LIMIARES E CONSEQUENCIAS
-- ---------------------------------------------------------------------

-- Histerese: entra em 100, so sai em 80. Evita o mundo piscando na fronteira.
CREATE TABLE limiar (
  id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  eixo            VARCHAR2(30)  NOT NULL REFERENCES eixo_destino(codigo),
  codigo          VARCHAR2(40)  NOT NULL UNIQUE,
  ordem           NUMBER(3)     NOT NULL,
  pontos_entrada  NUMBER(10)    NOT NULL,
  pontos_saida    NUMBER(10)    NOT NULL,
  efeito_codigo   VARCHAR2(40)  NOT NULL,  -- o Unity mapeia isto para o que ve
  descricao       VARCHAR2(200),
  CONSTRAINT ck_histerese CHECK (pontos_saida <= pontos_entrada)
);

CREATE TABLE estado_limiar (
  jogador_id   NUMBER       NOT NULL REFERENCES jogador(id),
  eixo         VARCHAR2(30) NOT NULL REFERENCES eixo_destino(codigo),
  limiar_id    NUMBER       REFERENCES limiar(id),
  dt_entrada   TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_estado_limiar PRIMARY KEY (jogador_id, eixo)
);

-- OUTBOX. O banco nao chama o jogo; o jogo consome o que o banco decidiu.
CREATE TABLE consequencia (
  id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jogador_id     NUMBER        NOT NULL REFERENCES jogador(id),
  sessao_id      NUMBER        REFERENCES sessao(id),
  efeito_codigo  VARCHAR2(40)  NOT NULL,
  payload        CLOB,
  dt_criacao     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  dt_entrega     TIMESTAMP,
  tentativas     NUMBER(3)     DEFAULT 0 NOT NULL,
  CONSTRAINT ck_conseq_json CHECK (payload IS JSON)
);
-- Indice esparso: so as pendentes ocupam entradas.
CREATE INDEX ix_conseq_pendente ON consequencia
  (CASE WHEN dt_entrega IS NULL THEN sessao_id END);


-- =====================================================================
--  SEED DA FATIA
-- =====================================================================

INSERT INTO zona (codigo, nome, cena_unity) VALUES ('SALA_A','Atrio','Scn_Atrio');
INSERT INTO zona (codigo, nome, cena_unity) VALUES ('SALA_B','Anexo','Scn_Anexo');

INSERT INTO tipo_evento VALUES ('AJUDA_REERGUER','Reergueu jogador caido','S');
INSERT INTO tipo_evento VALUES ('PORTAL_ATRAVESSOU','Atravessou portal','S');

INSERT INTO eixo_destino VALUES ('SOLIDARIEDADE','Solidariedade',-500,500);

-- A UNICA regra da fatia.
INSERT INTO regra_destino (codigo, eixo, tipo_evento, peso, janela_seg,
                         max_ocorrencias, exige_alvo_distinto, probabilidade)
VALUES ('REERGUER_ALIADO','SOLIDARIEDADE','AJUDA_REERGUER',
        10, 1800, 3, 'S', 1);

-- Um unico limiar visivel. Com histerese.
INSERT INTO limiar (eixo, codigo, ordem, pontos_entrada, pontos_saida,
                    efeito_codigo, descricao)
VALUES ('SOLIDARIEDADE','SOLIDARIO_1',1,30,20,
        'LUZ_QUENTE','A iluminacao da sala muda de tom para o jogador');

COMMIT;


-- =====================================================================
--  PACKAGE
-- =====================================================================

CREATE OR REPLACE PACKAGE pkg_destino AS

  -- Chamado pelo servidor de zona ao FIM de uma acao, nunca por frame.
  PROCEDURE registrar_evento (
    p_evento_uid   IN  RAW,
    p_sessao_id    IN  NUMBER,
    p_tipo_evento  IN  VARCHAR2,
    p_ator_id      IN  NUMBER,
    p_alvo_id      IN  NUMBER   DEFAULT NULL,
    p_valor        IN  NUMBER   DEFAULT NULL,
    p_contexto     IN  CLOB     DEFAULT NULL,
    p_dt_evento    IN  TIMESTAMP,
    p_evento_id    OUT NUMBER
  );

  -- Outbox: devolve pendentes da sessao e marca como entregues.
  PROCEDURE consumir_consequencias (
    p_sessao_id  IN  NUMBER,
    p_cursor     OUT SYS_REFCURSOR
  );

  -- Reconstroi saldo a partir do ledger (o ledger e' a verdade).
  PROCEDURE reconstruir_saldo (p_jogador_id IN NUMBER DEFAULT NULL);

END pkg_destino;
/

CREATE OR REPLACE PACKAGE BODY pkg_destino AS

  ------------------------------------------------------------------
  PROCEDURE avaliar_limiares (p_jogador_id IN NUMBER, p_eixo IN VARCHAR2)
  IS
    v_saldo    NUMBER;
    v_atual    NUMBER;
    v_novo     NUMBER;
    v_efeito   VARCHAR2(40);
  BEGIN
    SELECT pontos INTO v_saldo
      FROM destino_saldo WHERE jogador_id = p_jogador_id AND eixo = p_eixo;

    BEGIN
      SELECT limiar_id INTO v_atual
        FROM estado_limiar WHERE jogador_id = p_jogador_id AND eixo = p_eixo;
    EXCEPTION WHEN NO_DATA_FOUND THEN v_atual := NULL;
    END;

    -- Maior limiar cujo gatilho o saldo satisfaz, respeitando histerese:
    -- para SUBIR precisa de pontos_entrada; para permanecer basta pontos_saida.
    SELECT MAX(id) KEEP (DENSE_RANK LAST ORDER BY ordem)
      INTO v_novo
      FROM limiar
     WHERE eixo = p_eixo
       AND ( v_saldo >= pontos_entrada
             OR (id = v_atual AND v_saldo >= pontos_saida) );

    IF NVL(v_novo,-1) <> NVL(v_atual,-1) THEN
      MERGE INTO estado_limiar e
      USING (SELECT p_jogador_id j, p_eixo x FROM dual) s
         ON (e.jogador_id = s.j AND e.eixo = s.x)
      WHEN MATCHED THEN UPDATE SET limiar_id = v_novo, dt_entrada = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (jogador_id, eixo, limiar_id)
                            VALUES (s.j, s.x, v_novo);

      SELECT efeito_codigo INTO v_efeito
        FROM limiar WHERE id = NVL(v_novo, v_atual);

      INSERT INTO consequencia (jogador_id, efeito_codigo, payload)
      VALUES (p_jogador_id,
              CASE WHEN v_novo IS NULL THEN v_efeito || '_OFF' ELSE v_efeito END,
              JSON_OBJECT('saldo' VALUE v_saldo));
    END IF;
  END avaliar_limiares;

  ------------------------------------------------------------------
  PROCEDURE aplicar_regras (p_evento_id IN NUMBER)
  IS
    v_ev      evento%ROWTYPE;
    v_ocorr   NUMBER;
    v_repet   NUMBER;
    v_roll    NUMBER;
    v_pontos  NUMBER;
  BEGIN
    SELECT * INTO v_ev FROM evento WHERE id = p_evento_id;

    FOR r IN (SELECT * FROM regra_destino
               WHERE tipo_evento = v_ev.tipo_evento
                 AND ativo = 'S'
                 AND v_ev.dt_evento >= vigencia_ini
                 AND (vigencia_fim IS NULL OR v_ev.dt_evento < vigencia_fim))
    LOOP
      -- teto de ocorrencias na janela deslizante
      SELECT COUNT(*) INTO v_ocorr
        FROM destino_lancamento
       WHERE jogador_id = v_ev.ator_id
         AND regra_id   = r.id
         AND pontos    <> 0
         AND dt_lancto  > SYSTIMESTAMP - NUMTODSINTERVAL(r.janela_seg,'SECOND');

      IF v_ocorr >= r.max_ocorrencias THEN
        CONTINUE;
      END IF;

      -- alvo repetido nao pontua (mata o loop cooperativo A<->B)
      IF r.exige_alvo_distinto = 'S' AND v_ev.alvo_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_repet
          FROM destino_lancamento kl
          JOIN evento e ON e.id = kl.evento_id
         WHERE kl.jogador_id = v_ev.ator_id
           AND kl.regra_id   = r.id
           AND kl.pontos    <> 0
           AND e.alvo_id     = v_ev.alvo_id
           AND kl.dt_lancto  > SYSTIMESTAMP - NUMTODSINTERVAL(r.janela_seg,'SECOND');
        IF v_repet > 0 THEN
          CONTINUE;
        END IF;
      END IF;

      -- o dado. Guardado mesmo quando falha: sem isto, regra oculta e'
      -- indepuravel e voce nunca sabe por que o jogador reclamou.
      v_roll   := DBMS_RANDOM.VALUE(0,1);
      v_pontos := CASE WHEN v_roll <= r.probabilidade THEN r.peso ELSE 0 END;

      INSERT INTO destino_lancamento
        (jogador_id, eixo, regra_id, evento_id, pontos, roll)
      VALUES (v_ev.ator_id, r.eixo, r.id, v_ev.id, v_pontos, v_roll);

      IF v_pontos <> 0 THEN
        MERGE INTO destino_saldo k
        USING (SELECT v_ev.ator_id j, r.eixo x FROM dual) s
           ON (k.jogador_id = s.j AND k.eixo = s.x)
        WHEN MATCHED THEN
          UPDATE SET pontos = pontos + v_pontos, dt_atualiz = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (jogador_id, eixo, pontos) VALUES (s.j, s.x, v_pontos);

        avaliar_limiares(v_ev.ator_id, r.eixo);
      END IF;
    END LOOP;
  END aplicar_regras;

  ------------------------------------------------------------------
  PROCEDURE registrar_evento (
    p_evento_uid   IN  RAW,
    p_sessao_id    IN  NUMBER,
    p_tipo_evento  IN  VARCHAR2,
    p_ator_id      IN  NUMBER,
    p_alvo_id      IN  NUMBER   DEFAULT NULL,
    p_valor        IN  NUMBER   DEFAULT NULL,
    p_contexto     IN  CLOB     DEFAULT NULL,
    p_dt_evento    IN  TIMESTAMP,
    p_evento_id    OUT NUMBER
  ) IS
  BEGIN
    INSERT INTO evento (evento_uid, sessao_id, tipo_evento, ator_id,
                        alvo_id, valor, contexto, dt_evento)
    VALUES (p_evento_uid, p_sessao_id, p_tipo_evento, p_ator_id,
            p_alvo_id, p_valor, p_contexto, p_dt_evento)
    RETURNING id INTO p_evento_id;

    aplicar_regras(p_evento_id);

  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      -- retry de rede: devolve o que ja existe, nao reprocessa
      SELECT id INTO p_evento_id FROM evento WHERE evento_uid = p_evento_uid;
  END registrar_evento;

  ------------------------------------------------------------------
  PROCEDURE consumir_consequencias (
    p_sessao_id  IN  NUMBER,
    p_cursor     OUT SYS_REFCURSOR
  ) IS
    v_ids SYS.ODCINUMBERLIST;
  BEGIN
    SELECT c.id BULK COLLECT INTO v_ids
      FROM consequencia c
      JOIN presenca p ON p.jogador_id = c.jogador_id
                     AND p.sessao_id  = p_sessao_id
                     AND p.dt_saida IS NULL
     WHERE c.dt_entrega IS NULL
       FOR UPDATE OF c.dt_entrega SKIP LOCKED;

    FORALL i IN 1 .. v_ids.COUNT
      UPDATE consequencia
         SET dt_entrega = SYSTIMESTAMP, tentativas = tentativas + 1
       WHERE id = v_ids(i);

    OPEN p_cursor FOR
      SELECT c.id, c.jogador_id, j.steam_id, c.efeito_codigo, c.payload
        FROM consequencia c
        JOIN jogador j ON j.id = c.jogador_id
       WHERE c.id MEMBER OF v_ids;
  END consumir_consequencias;

  ------------------------------------------------------------------
  PROCEDURE reconstruir_saldo (p_jogador_id IN NUMBER DEFAULT NULL)
  IS
  BEGIN
    MERGE INTO destino_saldo k
    USING (SELECT jogador_id, eixo, SUM(pontos) pontos
             FROM destino_lancamento
            WHERE p_jogador_id IS NULL OR jogador_id = p_jogador_id
            GROUP BY jogador_id, eixo) s
       ON (k.jogador_id = s.jogador_id AND k.eixo = s.eixo)
    WHEN MATCHED THEN
      UPDATE SET k.pontos = s.pontos, k.dt_atualiz = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (jogador_id, eixo, pontos) VALUES (s.jogador_id, s.eixo, s.pontos);
  END reconstruir_saldo;

END pkg_destino;
/
