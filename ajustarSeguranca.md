# Code Review: leads-app — auditoria de segurança

Data: 2026-04-30
Escopo: `leads-app/` (Express + Postgres + EJS + Passport-Google + bcrypt)

## Resumo

App Express com sessão em Postgres, EJS, Passport-Google e bcrypt. A parametrização SQL está consistente (toda query usa `$1, $2…`), porém há **falhas críticas** em autenticação, gestão de senhas e proteção contra CSRF.

---

## Issues críticos

| # | Arquivo | Linha | Issue | Severidade |
|---|---------|-------|-------|------------|
| 1 | `src/routes/auth.js` | 96–103 | **Comparação de senha em texto puro com fallback automático.** Se `senha_hash` não bate com a regex bcrypt, faz `senha === u.senha_hash` direto. Isso confirma que há senhas em plaintext no banco e usa comparação não-constant-time (timing attack). Qualquer dump do DB vaza senhas reais. | Crítico |
| 2 | `scripts/criar-admin.js` | 8–9 | **Credenciais hardcoded e commitadas no git.** `admin@prospect.local` / `Mudar@2026` está no repositório e copiado pra dentro do container via Dockerfile. Qualquer instalação nova já nasce com senha conhecida; pior, o script ainda imprime a senha em `console.log` (linha 22), vazando-a nos logs do Docker. | Crítico |
| 3 | `src/routes/auth.js` | 56–62 | **Auto-provisionamento via Google OAuth.** Qualquer e-mail Google autentica e o app **cria conta automaticamente com perfil `operador`** sem aprovação. Isso significa que qualquer pessoa do mundo com conta Google pode se logar no sistema. | Crítico |
| 4 | `src/app.js` (todo) | — | **Sem proteção CSRF.** Não há `csurf`/`csrf-csrf`, e o cookie de sessão não declara `sameSite`. Logo, formulários POST de `/leads/:id/excluir`, `/usuarios/novo`, `/whatsapp/desconectar`, `/login`, `/esqueci-senha`, etc. são forjáveis. | Crítico |

---

## Issues altos

| # | Arquivo | Linha | Issue | Severidade |
|---|---------|-------|-------|------------|
| 5 | `src/routes/auth.js` | 107 | **Session fixation.** Após login bem-sucedido, atribui `req.session.usuario` direto sem chamar `req.session.regenerate()`. Atacante consegue plantar um SID, fazer a vítima logar e herdar a sessão autenticada. | Alto |
| 6 | `src/routes/auth.js` | 141–147 | **HTML injection no e-mail de reset.** `<strong>${u.nome}</strong>` interpola o nome direto no HTML do e-mail. Como o nome é controlado pelo usuário (cadastro/Google), é stored-XSS via e-mail (executa em alguns webmails). | Alto |
| 7 | `src/routes/auth.js` | 81–113, 121–154 | **Sem rate limiting** em `/login`, `/esqueci-senha`, `/redefinir-senha/:token`. Permite brute-force de senha, brute-force de token de reset (tokens são 64 hex, então 2^256 — ok — mas o login não tem nenhuma proteção) e enumeração por timing. | Alto |
| 8 | `src/app.js` | — | **Sem `helmet()` nem CSP.** Falta `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`. App vulnerável a clickjacking e MIME sniffing. | Alto |

---

## Issues médios

| # | Arquivo | Linha | Issue | Severidade |
|---|---------|-------|-------|------------|
| 9 | `src/app.js` | 20–26 | Cookie de sessão sem `sameSite` explícito e sem `httpOnly` declarado (default é true, mas torne explícito). Adicione `sameSite: 'lax'` (ou `strict`). | Médio |
| 10 | `src/routes/auth.js` | 176 | Senha mínima de 6 caracteres — NIST SP 800-63B recomenda 8+ e checar contra listas de senhas comuns. | Médio |
| 11 | `src/routes/leads.js`, `usuarios.js` | vários | **IDOR potencial.** Qualquer operador edita/exclui qualquer lead. Se a regra de negócio é "leads são compartilhados", ok; se não, falta filtro por owner (`AND criado_por = $X`). | Médio |
| 12 | `src/routes/leads.js` | 154, 160, 178 | `req.params.id` é passado direto pro Postgres como string. Não é SQLi (parametrizado), mas se vier `/leads/abc/editar` lança erro 500 não tratado. Coloque `Number(req.params.id)` + 404 se NaN. | Médio |
| 13 | `src/routes/leads.js` | 75–101 | Upload aceita qualquer arquivo cuja extensão termine em `.csv/.xlsx/.xls`, sem checar magic bytes nem `mimetype`. Trocar `.exe` por `.csv` passa pelo filtro. ExcelJS já mitiga payload Office malicioso, mas vale validar com `req.file.mimetype`. | Médio |
| 14 | `src/views/layout.ejs` | 108 | `<%- body %>` faz render raw — necessário pro layout do `express-ejs-layouts`. Confirme que **toda** view interna usa `<%= %>` (escapado) e nunca `<%- %>` para campos que vêm do banco (nome, observações, empresa). Sugiro grep nas views. | Médio |

---

## Issues baixos

| # | Arquivo | Linha | Issue | Severidade |
|---|---------|-------|-------|------------|
| 15 | `src/db.js` | 22–26 | Migrations rodam no boot sem lock distribuído. Se subir 2 réplicas, ambas tentam o `ALTER` em paralelo; algumas darão erro silencioso. Use `pg-migrate` ou `flyway`. | Baixo |
| 16 | `package.json` | — | Sem `helmet`, `express-rate-limit`, `csurf`, `express-validator`. Adicionar. Versões em `^` permitem upgrades minor automáticos — considere `npm audit` no CI. | Baixo |
| 17 | `Dockerfile` | 1–8 | Roda como root. Adicione `USER node` (a imagem `node:20-alpine` já tem o usuário criado). | Baixo |

---

## O que está bom

- Toda query SQL usa parâmetros `$1…` (sem SQL injection).
- bcrypt com `SALT_ROUNDS = 12` (adequado em 2026).
- Token de reset com `crypto.randomBytes(32)` e expira em 1h (correto).
- Reset não revela se o e-mail existe (response constante).
- Verifica "último admin" antes de permitir exclusão.
- `secure: true` no cookie quando `NODE_ENV === 'production'`.
- Validação de status de lead contra whitelist (`STATUS_VALIDOS`) antes de injetar no `WHERE`.
- Limite de 10MB no upload.

---

## Veredicto

**Request changes — bloquear deploy em produção até resolver os 4 críticos.** A combinação de senhas em plaintext no DB + admin com senha conhecida + auto-provisioning via Google + ausência de CSRF expõe o sistema a takeover total com pouquíssimo esforço.

---

## Plano de remediação sugerido (em ordem)

1. Migrar todas as senhas em plaintext do banco para bcrypt num script de hotfix e remover o branch do `else` na linha 96 de `auth.js`.
2. Remover `criar-admin.js` do Dockerfile (`COPY scripts/`); mover pra `scripts/` fora da imagem ou aceitar `ADMIN_EMAIL`/`ADMIN_PASSWORD` via env vars sem default.
3. Adicionar whitelist de domínios/e-mails no Google OAuth (`hostedDomain` ou checar `email` contra tabela `usuarios_permitidos` antes de criar conta).
4. Instalar `csurf` (ou `csrf-csrf`) + `helmet` + `express-rate-limit` no `app.js`.
5. Trocar `req.session.usuario = u` por `req.session.regenerate(() => { req.session.usuario = u; res.redirect(...) })` em login senha-e-email e callback Google.
6. Sanitizar `u.nome` antes de injetar no HTML do e-mail (`he.encode(u.nome)` ou template seguro).

---

## Checklist de execução

- [ ] #1 Hotfix de senhas plaintext + remoção do fallback
- [ ] #2 Remover `criar-admin.js` da imagem; trocar por env vars
- [ ] #3 Whitelist no Google OAuth
- [ ] #4 CSRF + helmet + rate limit
- [ ] #5 `session.regenerate()` no login
- [ ] #6 Escapar nome no e-mail de reset
- [ ] #7 `sameSite` + `httpOnly` explícitos no cookie
- [ ] #8 Senha mínima → 8 + lista de comuns
- [ ] #9 Validação de ownership em leads (se aplicável)
- [ ] #10 `Number(req.params.id)` + 404 se NaN
- [ ] #11 Validar `mimetype` no upload
- [ ] #12 Auditar `<%- %>` em todas as views
- [ ] #13 Mover migrations pra `pg-migrate`
- [ ] #14 `USER node` no Dockerfile
- [ ] #15 `npm audit` no CI
