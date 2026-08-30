# Setup do ambiente — Node.js + Oracle ADB

Tempo estimado: 1 hora (a maior parte esperando o banco provisionar).
Espaço em disco: ~2 GB.

Comparado ao ambiente Unity, isto é trivial. Nenhuma exigência de
hardware relevante: qualquer notebook que rode VS Code roda tudo aqui.

---

## Passo 1 — Node.js

Instale a versão **LTS**.

```bash
# Windows
winget install OpenJS.NodeJS.LTS

# macOS
brew install node

# Linux (Ubuntu/Debian) — o do apt costuma ser antigo demais
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

Conferir:

```bash
node --version    # v20 ou superior
npm --version
```

> Se você mexer com vários projetos Node no futuro, vale instalar via
> `nvm` em vez do instalador direto — permite trocar de versão por
> projeto. Para este projeto sozinho, o instalador basta.

---

## Passo 2 — VS Code e extensões

1. Instale: https://code.visualstudio.com
2. Extensões:
   - **Oracle SQL Developer Extension for VSCode** — PL/SQL e JS no mesmo
     editor, sem trocar de janela
   - **ESLint** — pega erro de JS antes de rodar
   - **REST Client** ou **Thunder Client** — testar o ORDS sem sair do
     editor

---

## Passo 3 — Git e Claude Code

```bash
# Git
# Windows: winget install Git.Git
# macOS:   brew install git
# Linux:   sudo apt install git

# Claude Code (instalador nativo, não precisa de Node)
curl -fsSL https://claude.ai/install.sh | bash        # macOS/Linux/WSL
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell

claude --version    # "command not found"? abra um terminal NOVO
claude doctor       # diagnóstico
```

Docs: https://code.claude.com/docs/en/setup

Coloque o `CLAUDE.md` na raiz do repositório antes da primeira sessão.
Sem ele, o Claude Code adivinha suas convenções toda vez.

---

## Passo 4 — Oracle Autonomous Database (Always Free)

1. Crie conta em https://www.oracle.com/cloud/free/
   (pede cartão para verificação; recursos Always Free não são cobrados)
2. **Anote sua Home Region.** Recursos Always Free só existem nela e não
   podem ser movidos depois.
3. Console → **Oracle Database** → **Autonomous Database** →
   **Create Autonomous Database**
   - Workload type: **Transaction Processing**
   - **Marque "Always Free"**
   - Senha do ADMIN: guarde num gerenciador de senhas
   - Network access: **Secure access from everywhere**
     (Always Free não suporta private endpoint / VCN)
4. Aguarde ~3 minutos até ficar *Available*.

### Guardrail de custo

Console → Governance → **Budgets** → budget de US$ 1 com alerta.
Se algo sair do Always Free por engano, você descobre no mesmo dia.

### Evitar reclamação por inatividade

O banco é parado após 7 dias sem uso e pode ser **excluído
permanentemente** após 90 dias cumulativos parado.

```sql
CREATE TABLE keepalive_log (dt TIMESTAMP);

BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_KEEPALIVE',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN INSERT INTO keepalive_log VALUES (SYSTIMESTAMP); COMMIT; END;',
    repeat_interval => 'FREQ=DAILY; BYHOUR=3',
    enabled         => TRUE);
END;
/
```

---

## Passo 5 — Schema e ORDS

Console do ADB → **Database actions** → **SQL** (entra como ADMIN):

```sql
CREATE USER game IDENTIFIED BY "TrocarEstaSenha#2026"
  QUOTA UNLIMITED ON DATA;

GRANT CONNECT, RESOURCE TO game;
GRANT CREATE VIEW, CREATE PROCEDURE, CREATE SEQUENCE TO game;

BEGIN
  ORDS_ADMIN.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'GAME',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'game',
    p_auto_rest_auth      => TRUE);
  COMMIT;
END;
/
```

Saia, entre como `GAME` e execute nesta ordem:

1. `db/destino_fatia_vertical.sql`
2. `db/destino_ords_setup.sql`

Guarde o `client_id` e o `client_secret` da última query. Sua URL base
ficará no formato:

```
https://<seu-adb>.oraclecloudapps.com/ords/game/destino/v1/
```

---

## Passo 6 — Esqueleto do projeto

```bash
mkdir meu-jogo && cd meu-jogo
git init
npm init -y
npm install express socket.io dotenv
npm install --save-dev nodemon
```

Em `package.json`, adicione o tipo de módulo e o script de dev:

```json
{
  "type": "module",
  "scripts": {
    "dev": "nodemon server/index.js",
    "start": "node server/index.js"
  }
}
```

> `"type": "module"` habilita `import`/`export` em vez de `require`.
> `nodemon` reinicia o servidor sozinho a cada arquivo salvo — é o que
> torna a iteração rápida.

### `.env` na raiz

```
ORDS_BASE=https://<seu-adb>.oraclecloudapps.com/ords/game
ORDS_CLIENT_ID=xxxxxxxxxxxxxxxxxx
ORDS_CLIENT_SECRET=xxxxxxxxxxxxxxxxxx
PORT=3000
```

### `.gitignore` — antes do primeiro commit

```
node_modules/
.env
*.log
```

**Confira que o `.env` está ignorado antes de commitar.** Segredo em
histórico de Git é segredo comprometido, mesmo depois de removido.

```bash
git add . && git status    # .env NÃO pode aparecer
```

---

## Passo 7 — Teste de fumaça

Antes de escrever qualquer coisa do jogo, valide o caminho inteiro.

**1. Token do ORDS**

```bash
curl -i -X POST \
  --user "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  https://<seu-adb>.oraclecloudapps.com/ords/game/oauth/token
```

**2. Abrir uma sessão**

```bash
curl -X POST https://<seu-adb>.oraclecloudapps.com/ords/game/destino/v1/sessao \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"zona_codigo":"SALA_A","servidor_host":"local"}'
```

**3. Gravar um evento**

```bash
curl -X POST https://<seu-adb>.oraclecloudapps.com/ords/game/destino/v1/evento \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"evento_uid":"3F2504E04F8911D39A0C0305E82C3301",
       "sessao_id":1,"tipo_evento":"AJUDA_REERGUER",
       "ator_id":1,"alvo_id":2,
       "dt_evento":"2026-08-18T14:30:00.000-03:00"}'
```

**4. Confirmar no banco**

```sql
SELECT * FROM evento;
SELECT * FROM destino_lancamento;
```

Se a linha estiver lá com o `roll` gravado, o ambiente está pronto.

---

## Passo 8 — Hospedagem (só quando for testar com outras pessoas)

Enquanto você testa sozinho ou na sua rede, `localhost` basta.

Para playtest com gente de fora, duas opções:

**Rápida e temporária:** um túnel como `ngrok` ou `cloudflared` expõe seu
`localhost:3000` numa URL pública em segundos. Ideal para uma sessão de
teste combinada.

**Permanente e gratuita:** o OCI Always Free inclui instâncias ARM
(Ampere) generosas — no mesmo tenancy do banco. Servidor e banco lado a
lado, sem custo. Vale a pena quando o protótipo estiver de pé.

> Ao contrário do banco, a instância de computação ARM depende de
> disponibilidade na região e às vezes demora a liberar. Não deixe para
> descobrir isso na véspera do primeiro playtest.

---

## Checklist final

- [ ] `node --version` retorna v20+
- [ ] `claude doctor` sem erros
- [ ] ADB Always Free provisionado na Home Region correta
- [ ] Budget de US$ 1 configurado
- [ ] Job de keepalive criado
- [ ] Scripts do schema executados
- [ ] `.env` preenchido **e** listado no `.gitignore`
- [ ] `git status` não mostra o `.env`
- [ ] Teste de fumaça: evento gravado com `roll` no ledger
