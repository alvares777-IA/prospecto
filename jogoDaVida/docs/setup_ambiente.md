# Setup do ambiente — Node.js + PostgreSQL

O banco já existe: o jogoDaVida roda como um serviço dentro do
`docker-compose.yml` do stack **PROSPECTO-IA**, e usa o container
PostgreSQL desse stack (`prospecto-ia-postgres-1`), num banco dedicado
`jogodavida`. Não há nada de nuvem para provisionar.

---

## Passo 1 — Node.js (só para rodar fora do container)

Dentro do Docker o Node já vem na imagem. Para rodar direto no host
(`npm run dev`), instale a versão **LTS**.

```bash
# Windows
winget install OpenJS.NodeJS.LTS
# macOS
brew install node
```

```bash
node --version    # v20 ou superior
```

---

## Passo 2 — VS Code e extensões

1. https://code.visualstudio.com
2. Extensões úteis:
   - **ESLint** — pega erro de JS antes de rodar
   - **REST Client** / **Thunder Client** — testar as rotas HTTP do servidor
   - um cliente Postgres (ex.: **SQLTools + driver PostgreSQL**) para
     inspecionar o banco `jogodavida`

---

## Passo 3 — Git e Claude Code

```bash
# Claude Code (instalador nativo, não precisa de Node)
curl -fsSL https://claude.ai/install.sh | bash        # macOS/Linux/WSL
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell

claude doctor
```

O `CLAUDE.md` fica na raiz de `jogoDaVida/` — o Claude Code lê antes de
qualquer coisa.

---

## Passo 4 — Subir o serviço

O `docker-compose.yml` do PROSPECTO-IA já tem o serviço `jogodavida`
(porta 3004, banco `jogodavida`, hot-reload).

```bash
cd caminho/para/PROSPECTO-IA
docker compose up -d --build jogodavida
docker compose logs -f jogodavida
```

O container espera o Postgres ficar saudável (`depends_on`) antes de
subir. O banco `jogodavida` é criado pelo `postgres/init.sql` do stack
na primeira inicialização do volume.

---

## Passo 5 — Aplicar o esquema

Todas as tabelas e o motor de destino (funções PL/pgSQL) estão em
`jogoDaVida/db/schema_pg.sql`. É idempotente — pode rodar de novo.

```bash
docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida \
  < jogoDaVida/db/schema_pg.sql
```

Conferir:

```bash
docker exec prospecto-ia-postgres-1 psql -U prospecto -d jogodavida -c "\dt" -c "\df"
```

### Enigmas

O catálogo (`enigma`) vem de `db/enigmas/` — `texto.csv` (100) + as
páginas interativas `enigma-###.html` (100). Carregar/atualizar:

```bash
# (uma vez) embaralha a ordem das opções nas páginas fonte — vinham com a
# resposta sempre em 1º; a validação é no servidor, reordenar não quebra nada
node jogoDaVida/db/embaralhar_opcoes.mjs

# páginas servidas (copia p/ public/enigmas/ REMOVENDO o gabarito data-answer;
# as páginas html só confirmam acerto dentro do jogo)
node jogoDaVida/db/publicar_enigmas.mjs

# importa para o banco (roda dentro do container)
docker cp jogoDaVida/db/enigmas prospecto-ia-jogodavida-1:/tmp/enigmas
docker exec -i prospecto-ia-jogodavida-1 node --input-type=module - /tmp/enigmas \
  < jogoDaVida/db/importar_enigmas.mjs
```

Sequência: intercala `texto` e `html` (ordem 1,2,3,4… = csv#1, html#1,
csv#2, html#2…). Mostrados **na ordem** (`enigma.ordem`), não aleatório.

### Painel de manutenção

`http://localhost:3004/admin` — CRUD das tabelas de apoio (`parametro`,
`enigma`, `avatar`, `era`, `zona`, `eixo_destino`, `tipo_evento`,
`regra_destino`, `limiar`). Login próprio: `ADMIN_USER` / `ADMIN_SENHA`
no `.env`.

---

## Passo 6 — Rodar direto no host (opcional, iteração mais rápida)

```bash
cd jogoDaVida
npm install
cp .env.example .env     # ajuste DATABASE_URL para localhost:5433
npm run dev              # nodemon, http://localhost:3004
```

`"type": "module"` no `package.json` habilita `import`/`export`.
Dependências de servidor: `express`, `socket.io`, `dotenv`, `pg`
(+ `passport`, `passport-google-oauth20`, `express-session`,
`connect-pg-simple` para o login).

---

## Passo 7 — Teste de fumaça do motor de destino

Valida o caminho inteiro pelo `psql`, sem subir o servidor:

```sql
-- cenário mínimo
INSERT INTO jogador (identificador, apelido, avatar_codigo, anonimo)
  VALUES ('t1','J1','A01','N'), ('t2','J2','A02','N');
INSERT INTO sessao (zona_id, servidor_host, codigo)
  SELECT id, 'teste', 'TST1' FROM zona WHERE codigo = 'SALA_A';
INSERT INTO presenca (sessao_id, jogador_id)
  SELECT (SELECT id FROM sessao WHERE codigo='TST1'), id
  FROM jogador WHERE identificador IN ('t1','t2');

-- registra um evento de ajuda
SELECT registrar_evento(gen_random_uuid(), s.id, 'AJUDA_REERGUER',
                         j1.id, j2.id, NULL, '{"sala":"SALA_A"}'::jsonb)
  FROM sessao s, jogador j1, jogador j2
 WHERE s.codigo='TST1' AND j1.identificador='t1' AND j2.identificador='t2';

-- o dado tem que estar gravado
SELECT pontos, roll FROM destino_lancamento;
SELECT * FROM destino_saldo;
```

Se a linha de `destino_lancamento` estiver lá com o `roll`, o motor está
funcionando.

---

## Passo 8 — Publicar (quando for testar com outras pessoas)

Enquanto testa sozinho ou na rede local, `http://localhost:3004` basta.

**Rápido e temporário:** um túnel (`cloudflared`, `ngrok`) expõe o
`localhost:3004` numa URL pública para uma sessão combinada.

**Definitivo:** endereço próprio `jogodavida.rssc.com.br`. O VirtualHost
já está pronto em `jogoDaVida/deploy/jogodavida.conf` (proxy para
`127.0.0.1:3004` + upgrade de WebSocket). O cabeçalho do arquivo tem o
passo a passo: registro A no DNS, `certbot`, e as variáveis de produção
(`NODE_ENV=production`, `JV_APP_URL=https://jogodavida.rssc.com.br`).

---

## Checklist

- [ ] `docker compose up -d jogodavida` sobe o container
- [ ] `schema_pg.sql` aplicado (`\dt` mostra 15 tabelas, `\df` mostra as funções)
- [ ] `http://localhost:3004/health` responde `{"ok":true,"db":"ok"}`
- [ ] Teste de fumaça: evento gravado com `roll` no ledger
- [ ] `.env` (se rodar no host) preenchido e ignorado pelo Git
