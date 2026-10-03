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

Jogos-arcade (`enigma-101.html`+): `tipo='jogo'`, resposta = limiar numérico de
pontuação (`data-answer` do `<html>`, ex.: 300). São importados à parte —
`importar_enigmas.mjs` só olha até `enigma-100.html` — pra não colidirem com o
catálogo de quiz:

```bash
MSYS_NO_PATHCONV=1 docker exec -i prospecto-ia-jogodavida-1 node --input-type=module - /tmp/enigmas \
  < jogoDaVida/db/importar_jogos.mjs
```

> No Git Bash do Windows, o `MSYS_NO_PATHCONV=1` impede que `/tmp/enigmas` vire
> um caminho do Windows. Se `/tmp/enigmas` já existir no container, o
> `docker cp` cria `/tmp/enigmas/enigmas` — use um destino novo.

O importador de jogos **só insere** o que ainda não existe: fase, ordem, meta,
`niveis` e ativo, depois de importados, são do `/admin` (reimportar não desfaz).
`enigma.niveis` = quantas fases o jogo tem por dentro (padrão 1).

**TIM** (`enigma-105.html` + `tim-fisica.js` + `tim-niveis.js`): desafios de
física estilo *The Incredible Machine*. Cada desafio é verificado por simulação —
resolve com as peças da caixa e não resolve sem elas:

```bash
node jogoDaVida/db/enigmas/tim-teste.mjs     # ~1 min; não é publicado em public/
```

**Enduro** (`enigma-106.html`): corrida estilo Atari, 3 fases (pista seca, chuva,
noite; `niveis = 3`). Meta 500 pts = completar 2 fases (10/carro + 50/fase). Teste
headless com bot (sem navegador): `node jogoDaVida/db/enigmas/enduro-teste.mjs`.

Sequência: intercala `texto` e `html` (ordem 1,2,3,4… = csv#1, html#1,
csv#2, html#2…). Mostrados **na ordem** (`enigma.ordem`), não aleatório.

### Painel de manutenção

`http://localhost:3004/admin` — CRUD das tabelas de apoio (`parametro`,
`enigma`, `avatar`, `era`, `zona`, `eixo_destino`, `tipo_evento`,
`regra_destino`, `limiar`). Login próprio: `ADMIN_USER` / `ADMIN_SENHA`
no `.env`.

### Energia pessoal, fase co-op, doação, desistir

**Energia**: `garantirPartida` dá `energia_inicial` (100) quando ninguém ainda
tem partida na sessão (início do jogo); quem entra com o jogo já rolando começa
com `MIN(energia_atual)` entre os jogadores ativos (`dt_fim IS NULL`). Não
carrega o `jogador.energia` de jogos anteriores. Dentro do jogo persiste
(`partida_jogador.energia`), não regenera com o tempo, só volta com
`bonus_enigma` ao resolver. `finalizarPartida` ainda grava `jogador.energia`
(+ `bonus_vitoria`) mas isso não é lido no início — a persistência entre salas
está desligada; `piso_energia` idem.

**Fase co-op**: atributo do catálogo (`enigma.fase`, número — enigmas com a
mesma fase = um trecho). Ao chegar nesse trecho da sua sequência, você vê um
tabuleiro compartilhado; qualquer um resolve qualquer enigma (coletivo, via
`sessao_enigma.resolvido_por`); completo, cada um clica "Prosseguir" e segue
sozinho. Chat livre, sem penalidade de spoiler dentro da fase. Marque as
fases no `/admin` (coluna `fase` em `enigma`). Posição na sequência = menor
`enigma.ordem` do trecho.

**Doação** (`doar_energia` / `pedir_doacao`): transfere `doacao_energia` %
(padrão 10) para outro jogador; vários podem doar; revive quem zerou.

**Desistir** (`desistir`): paga `custo_desistir` % (padrão 20), o jogo revela
a resposta (você ainda tem de enviá-la). Marca de caráter negativa se havia
outro jogador à frente (`desistencia.orgulho`).

**Game over da sala**: quando ninguém em pé sobra e nem todos concluíram
(`sessao.estado = 'encerrada'`, evento `sala_derrota`).

Parâmetros globais (editáveis no `/admin`): `bonus_enigma`, `bonus_vitoria`,
`piso_energia`, `doacao_energia`, `custo_desistir`. O `schema_pg.sql` é
idempotente; reaplicar adiciona `enigma.fase`, a tabela `desistencia` e
remove o que sobrou do desenho antigo de "modo de sala".

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
