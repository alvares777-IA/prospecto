-- =====================================================================
--  ORDS - camada REST do motor de destino
--  Consumidor: SERVIDOR DEDICADO de zona. NUNCA o cliente Unity.
-- =====================================================================
--  Executar como o schema dono das tabelas (ex: GAME).
--  Pre-requisito: ORDS instalado e o schema habilitado pelo ADMIN:
--
--     BEGIN
--       ORDS.ENABLE_SCHEMA(
--         p_enabled             => TRUE,
--         p_schema              => 'GAME',
--         p_url_mapping_type    => 'BASE_PATH',
--         p_url_mapping_pattern => 'game',
--         p_auto_rest_auth      => TRUE);   -- nada de AutoREST aberto
--       COMMIT;
--     END;
--     /
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. MODULO E ROTAS
-- ---------------------------------------------------------------------
BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'destino.v1',
    p_base_path      => '/destino/v1/',
    p_items_per_page => 0,                  -- sem paginacao automatica
    p_status         => 'PUBLISHED',
    p_comments       => 'Motor de destino - consumido pelo servidor de zona');


  -- ------------------------------------------------------------------
  -- POST /destino/v1/sessao   -> abre instancia de zona
  -- ------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'destino.v1',
    p_pattern     => 'sessao');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'destino.v1',
    p_pattern     => 'sessao',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
      DECLARE
        v_zona_id NUMBER;
      BEGIN
        SELECT id INTO v_zona_id FROM zona WHERE codigo = :zona_codigo;

        INSERT INTO sessao (zona_id, servidor_host)
        VALUES (v_zona_id, :servidor_host)
        RETURNING id INTO :sessao_id;

        :status_code := 201;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          :status_code := 404;
      END;
    ]');


  -- ------------------------------------------------------------------
  -- POST /destino/v1/presenca  -> jogador entrou na sessao
  -- ------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'destino.v1',
    p_pattern     => 'presenca');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'destino.v1',
    p_pattern     => 'presenca',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
      BEGIN
        MERGE INTO jogador j
        USING (SELECT :steam_id s, :apelido a FROM dual) d
           ON (j.steam_id = d.s)
        WHEN MATCHED THEN UPDATE SET j.apelido = d.a
        WHEN NOT MATCHED THEN INSERT (steam_id, apelido) VALUES (d.s, d.a);

        SELECT id INTO :jogador_id FROM jogador WHERE steam_id = :steam_id;

        INSERT INTO presenca (sessao_id, jogador_id)
        VALUES (:sessao_id, :jogador_id);

        SELECT NVL(s.pontos,0) INTO :saldo
          FROM dual LEFT JOIN destino_saldo s
            ON s.jogador_id = :jogador_id AND s.eixo = 'SOLIDARIEDADE'
           ON 1=1;

        :status_code := 201;
      END;
    ]');


  -- ------------------------------------------------------------------
  -- POST /destino/v1/evento   -> o unico caminho de escrita do gameplay
  -- ------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'destino.v1',
    p_pattern     => 'evento');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'destino.v1',
    p_pattern     => 'evento',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
      BEGIN
        pkg_destino.registrar_evento(
          p_evento_uid  => HEXTORAW(:evento_uid),        -- GUID sem hifens
          p_sessao_id   => :sessao_id,
          p_tipo_evento => :tipo_evento,
          p_ator_id     => :ator_id,
          p_alvo_id     => :alvo_id,
          p_valor       => :valor,
          p_contexto    => :contexto,
          p_dt_evento   => TO_TIMESTAMP_TZ(:dt_evento,
                             'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
          p_evento_id   => :evento_id);

        :status_code := 202;   -- aceito; consequencias vem pelo outbox
      EXCEPTION
        WHEN OTHERS THEN
          :status_code := 400;
          :erro := SQLERRM;
      END;
    ]');


  -- ------------------------------------------------------------------
  -- POST /destino/v1/consequencias  -> outbox
  --   POST, nao GET: a chamada MARCA como entregue. Nao e' idempotente.
  -- ------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'destino.v1',
    p_pattern     => 'consequencias');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'destino.v1',
    p_pattern     => 'consequencias',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
      BEGIN
        pkg_destino.consumir_consequencias(
          p_sessao_id => :sessao_id,
          p_cursor    => :itens);          -- ORDS serializa o REF CURSOR
      END;
    ]');


  -- ------------------------------------------------------------------
  -- PUT /destino/v1/sessao/:id/encerrar
  -- ------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'destino.v1',
    p_pattern     => 'sessao/:id/encerrar');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'destino.v1',
    p_pattern     => 'sessao/:id/encerrar',
    p_method      => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      BEGIN
        UPDATE presenca SET dt_saida = SYSTIMESTAMP
         WHERE sessao_id = :id AND dt_saida IS NULL;

        UPDATE sessao SET dt_encerramento = SYSTIMESTAMP
         WHERE id = :id AND dt_encerramento IS NULL;

        :status_code := 204;
      END;
    ]');

  COMMIT;
END;
/


-- ---------------------------------------------------------------------
-- 2. PARAMETROS DE SAIDA (status HTTP)
--    OUT binds simples ja voltam no corpo JSON automaticamente.
--    O status code precisa ser declarado como header de resposta.
-- ---------------------------------------------------------------------
BEGIN
  FOR r IN (
    SELECT 'sessao'        pat, 'POST' met FROM dual UNION ALL
    SELECT 'presenca',          'POST'     FROM dual UNION ALL
    SELECT 'evento',            'POST'     FROM dual UNION ALL
    SELECT 'sessao/:id/encerrar','PUT'     FROM dual )
  LOOP
    ORDS.DEFINE_PARAMETER(
      p_module_name        => 'destino.v1',
      p_pattern            => r.pat,
      p_method             => r.met,
      p_name               => 'X-APEX-STATUS-CODE',
      p_bind_variable_name => 'status_code',
      p_source_type        => 'HEADER',
      p_param_type         => 'INT',
      p_access_method       => 'OUT');
  END LOOP;
  COMMIT;
END;
/


-- ---------------------------------------------------------------------
-- 3. SEGURANCA
--    Sem isto o endpoint fica publico e qualquer um forja destino.
-- ---------------------------------------------------------------------
BEGIN
  -- 3.1 Role que o servidor de zona vai carregar
  ORDS.CREATE_ROLE(p_role_name => 'destino_servidor');

  -- 3.2 Privilegio protegendo TODO o modulo
  ORDS.DEFINE_PRIVILEGE(
    p_privilege_name => 'destino.escrita',
    p_roles          => ORDS_TYPES.ROLES_T('destino_servidor'),
    p_patterns       => ORDS_TYPES.PATTERNS_T('/destino/v1/*'),
    p_modules        => ORDS_TYPES.MODULES_T('destino.v1'),
    p_label          => 'Motor de destino',
    p_description    => 'Escrita de eventos e leitura do outbox');

  COMMIT;
END;
/

BEGIN
  -- 3.3 Cliente OAuth2 client_credentials (machine-to-machine)
  OAUTH.CREATE_CLIENT(
    p_name            => 'servidor_zona',
    p_grant_type      => 'client_credentials',
    p_owner           => 'GAME',
    p_description     => 'Processo de servidor dedicado Unity',
    p_support_email   => 'voce@exemplo.com',
    p_privilege_names => 'destino.escrita');

  OAUTH.GRANT_CLIENT_ROLE(
    p_client_name => 'servidor_zona',
    p_role_name   => 'destino_servidor');

  COMMIT;
END;
/

-- 3.4 Pegue as credenciais (guarde fora do repositorio!)
SELECT name, client_id, client_secret
  FROM user_ords_clients
 WHERE name = 'servidor_zona';


-- =====================================================================
--  TESTE RAPIDO
-- =====================================================================
--  Token (expira; o servidor deve cachear ate ~60s antes do vencimento):
--
--    curl -i -X POST \
--      --user "CLIENT_ID:CLIENT_SECRET" \
--      -d "grant_type=client_credentials" \
--      https://SEU_HOST/ords/game/oauth/token
--
--  Evento:
--
--    curl -X POST https://SEU_HOST/ords/game/destino/v1/evento \
--      -H "Authorization: Bearer $TOKEN" \
--      -H "Content-Type: application/json" \
--      -d '{"evento_uid":"3F2504E04F8911D39A0C0305E82C3301",
--           "sessao_id":1,
--           "tipo_evento":"AJUDA_REERGUER",
--           "ator_id":1,
--           "alvo_id":2,
--           "valor":null,
--           "contexto":"{\"sala\":\"SALA_A\"}",
--           "dt_evento":"2026-08-16T14:30:00.000-03:00"}'
--
--  Outbox:
--
--    curl -X POST https://SEU_HOST/ords/game/destino/v1/consequencias \
--      -H "Authorization: Bearer $TOKEN" \
--      -H "Content-Type: application/json" \
--      -d '{"sessao_id":1}'
-- =====================================================================
