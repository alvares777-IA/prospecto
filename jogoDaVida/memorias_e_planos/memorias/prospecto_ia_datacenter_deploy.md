---
name: prospecto-ia-datacenter-deploy
description: Passo a passo e pegadinhas pra publicar um novo serviço/subdomínio do PROSPECTO-IA no datacenter — aprendido publicando jogoDaVida (jogodavida.rssc.com.br) em 29/09/2026
metadata:
  node_type: memory
  type: project
  originSessionId: 7ce7da2f-2c11-442c-aa14-5846a94c68c6
  modified: 2026-09-29T21:33:33.547Z
---

Arquitetura de produção do PROSPECTO-IA: Internet → Cloudflare (DNS only) → Nginx Proxy Manager (container `ngix-app-1` em 192.168.210.8, painel `:81`) → Apache (vhosts em `/etc/httpd/conf.d/` no web-by, 192.168.210.7) → containers Docker (`docker-compose.yml`, stack em `/home/producao/prospecto/` no mesmo 192.168.210.7). Acessos: [[prospecto-ia-infra-access]].

Checklist pra publicar um novo subdomínio:

1. Cloudflare: registro A pro domínio → `200.143.179.45`, modo "DNS only" (nuvem cinza).
2. Apache no web-by: vhost `:80` só (sem `:443` ainda), proxy pra `127.0.0.1:<porta-do-app>`. `ProxyPass /.well-known/ !` tem que estar em linha própria — comentário `#` na mesma linha quebra o parser (`ProxyPass` trata o resto da linha como parâmetros `key=value` e dá `Invalid ProxyPass parameter`).
3. `apachectl configtest` **precisa rodar com `sudo`** — sem isso, erro de permissão pra ler `/etc/letsencrypt/` aparece disfarçado de `SSLCertificateFile: file ... does not exist or is empty`, parecendo problema de certificado quando não é.
4. **Cadastrar o domínio no Nginx Proxy Manager (painel `:81`) ANTES de rodar certbot.** Sem isso o desafio HTTP-01 do certbot nunca chega no Apache — cai num 404 do próprio NPM (`curl -I` no domínio mostra `Server: openresty` no 404, sinal de que nem saiu do proxy). No proxy host, usar **scheme `http`, forward pra porta local do app** (ex. `192.168.210.7:80`) — mesmo padrão dos subdomínios que já funcionam (`app.prospect.rssc.com.br` etc.); não precisa (nem deve) ser https/443, mesmo o Apache tendo certificado próprio depois.
5. Só depois do passo 4, rodar `sudo certbot --apache -d <dominio>`.
6. **Pegadinha do certbot:** ele insere automaticamente no vhost `:80` um redirect forçado pra https (`RewriteCond %{SERVER_NAME} =<dominio>` + `RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]`, geralmente logo antes do `</VirtualHost>`). Como o NPM já termina o HTTPS público e reencaminha em http puro pro Apache, esse redirect causa loop infinito (`ERR_TOO_MANY_REDIRECTS`) assim que o navegador tenta abrir o site. **Remover essas 2 linhas manualmente** depois do certbot rodar, e recarregar o Apache (`sudo apachectl configtest && sudo systemctl reload httpd`).
7. **Banco Postgres:** o `postgres/init.sql` do stack (que cria o banco de cada serviço) só roda na **primeira inicialização do volume** `postgres_data`. Como esse volume já existe desde abril/2026 (outros serviços — n8n, typebot, evolution, leads), o banco de um serviço novo **nunca é criado automaticamente** ao adicionar o serviço depois. É preciso `CREATE DATABASE` manual (conectando num banco que já existe, tipo `prospecto`) + `GRANT ALL PRIVILEGES` + aplicar o schema SQL do serviço à mão.
8. **`.env` no servidor:** depois de editar com `vi`, sempre confirmar com `docker exec <container> env | grep VAR` que o valor realmente entrou no container — já aconteceu de uma edição não colar e o `docker compose up` seguir mostrando o WARN de variável vazia mesmo após o `vi`. Cuidado extra: se `DATABASE_URL` fica sem nome de banco no final (variável de nome do banco vazia), a conexão Postgres cai silenciosamente no banco padrão (mesmo nome do usuário, ex. `prospecto`) em vez de dar erro de conexão — então `/health` da aplicação pode reportar `"db":"ok"` mesmo estando plugada no banco errado. Não confiar só no `/health`; conferir o `DATABASE_URL` real dentro do container quando algo relacionado a dado não aparece.
9. Nome dos containers segue o padrão `prospecto-<service>-1` (ex. `prospecto-postgres-1`, `prospecto-jogodavida-1`) — **não** `prospecto-ia-*`, apesar de alguns docs antigos do repo (`STATUS.md`) usarem esse prefixo.

Logs pra depurar cada camada:
- Apache: `/var/log/httpd/<app>-error.log` e `-access.log` (caminho definido no próprio vhost do serviço).
- App (container): `docker compose logs -f <service>` ou `docker logs -f <container>`.
- NPM: `docker exec ngix-app-1 ls /data/logs` pra achar o id, depois `tail -f /data/logs/proxy-host-<id>_{access,error}.log`.

**Why:** essa sequência (DNS → NPM → Apache/certbot → redirect → banco) tem 4 armadilhas silenciosas diferentes (proxy não cadastrado, permissão de sudo, redirect duplicado, banco nunca criado) que consumiram uma sessão inteira de troubleshooting na primeira vez (jogoDaVida, set/2026), cada uma com sintoma parecido de "não funciona" mas causa raiz bem diferente.
**How to apply:** seguir este checklist, na ordem, sempre que subir um novo serviço/subdomínio do PROSPECTO-IA nesse datacenter (próximo pode ser outro protótipo do mesmo stack).
