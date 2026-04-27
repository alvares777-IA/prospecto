# Status do Projeto — Prospecto-IA
**Última atualização:** 2026-04-27

---

## O que já está pronto

### Servidor web-by (192.168.210.7) — Apache
- [x] Certificado SSL emitido via Certbot + plugin Cloudflare DNS
      Cobre os 4 subdomínios, expira em 2026-07-23, **renovação automática configurada**
      Arquivos em: `/etc/letsencrypt/live/n8n.prospect.rssc.com.br/`
- [x] VirtualHosts HTTP criados: `/etc/httpd/conf.d/prospect.conf`
- [x] VirtualHosts HTTPS criados: `/etc/httpd/conf.d/prospect-ssl.conf`
- [x] Apache rodando e saudável (`systemctl status httpd`)
- [x] Docker instalado (interface docker0 presente)
- [x] Credenciais Cloudflare salvas em `/etc/letsencrypt/cloudflare.ini` (chmod 600)

### DNS (Cloudflare)
- [x] `n8n.prospect.rssc.com.br`      → 200.143.179.45
- [x] `api.prospect.rssc.com.br`      → 200.143.179.45
- [x] `bot.prospect.rssc.com.br`      → 200.143.179.45
- [x] `builder.prospect.rssc.com.br`  → 200.143.179.45
  Todos em modo "DNS only" (sem proxy Cloudflare).

---

## O que está pendente

### 1. ~~Técnico de infraestrutura — BLOQUEADOR~~ ✅ CONCLUÍDO 2026-04-27
Nginx Proxy Manager (container `ngix-app-1` em `192.168.210.8`) configurado via API.
4 proxy hosts criados, certificado LE #65 emitido cobrindo todos os subdomínios.

### 2. ~~Subir os containers Docker~~ ✅ CONCLUÍDO 2026-04-27
Stack completa rodando em `/home/producao/prospecto/` no servidor `192.168.210.7`.
Todos os serviços respondendo em HTTPS.

### 3. ~~Schema SQL dos leads~~ ✅ CONCLUÍDO 2026-04-27
Tabela `leads` criada no banco `leads`. Arquivo: `postgres/schema.sql`.

### 4. Sistema web de manutenção da lista
Interface para cadastro e gestão de leads — ainda não iniciado.

---

## Arquitetura resumida

```
Internet
    │
    ▼
200.143.179.45
[OpenResty — 192.168.210.8]   ← técnico precisa configurar aqui
    │
    ▼
192.168.210.7  (web-by)
[Apache — ports 80/443]        ← já configurado
    │
    ▼
[Docker containers]            ← ainda não sobem
    ├── n8n          :5678
    ├── Evolution API :8080
    ├── Typebot Viewer :3002
    ├── Typebot Builder :3001
    ├── PostgreSQL    :5432
    └── Redis         :6379
```

---

## Arquivos do projeto

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.yml` | Orquestração de todos os containers |
| `.env` | Variáveis de ambiente (preencher senhas antes de subir) |
| `postgres/init.sql` | Cria os bancos: n8n, typebot, evolution, leads |
| `prospect.conf` | VirtualHosts HTTP Apache (porta 80) |
| `prospect-ssl.conf` | VirtualHosts HTTPS Apache (porta 443) |
| `infra-openresty-solicitacao.md` | Documento para o técnico de infra |

**Arquivos já no servidor** (`/etc/httpd/conf.d/`):
- `prospect.conf`
- `prospect-ssl.conf`

---

## Observações importantes

- **Não mexer** em `/etc/httpd/conf/httpd.conf` nem em `/etc/httpd/conf/dads.conf`
  — configuração de produção existente, apps Oracle Web em produção
- O nginx (`/etc/nginx/`) está instalado mas **parado e desabilitado** — ignorar
- O banco Oracle fica na VM separada `db-by` (192.168.210.x) — não usar para Docker
- O `.env` contém senhas — **nunca versionar com valores reais**
