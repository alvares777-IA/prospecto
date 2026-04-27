# Status do Projeto — Prospecto-IA
**Última atualização:** 2026-04-24

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

### 1. Técnico de infraestrutura — BLOQUEADOR
O proxy OpenResty em `192.168.210.8` precisa ser configurado para rotear
os 4 novos subdomínios até o Apache em `192.168.210.7`.
Documento completo para o técnico: `infra-openresty-solicitacao.md`

Validação após configuração do técnico:
```bash
curl -I https://n8n.prospect.rssc.com.br
# Esperado: qualquer resposta que NÃO seja "404 openresty"
# 502 Bad Gateway do Apache é OK (containers ainda não sobem)
```

### 2. Subir os containers Docker
Após o OpenResty estar configurado:
```bash
cd /caminho/do/projeto
# Preencher o .env com senhas reais antes
docker compose up -d
docker compose logs -f --tail=50
```
Gerar as chaves secretas antes:
```bash
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "TYPEBOT_SECRET=$(openssl rand -hex 32)"
echo "TYPEBOT_ENCRYPTION_SECRET=$(openssl rand -hex 16)"
echo "EVOLUTION_API_KEY=$(openssl rand -hex 20)"
```

### 3. Schema SQL dos leads
Tabela `leads` no banco PostgreSQL (banco `leads`) ainda não foi criada.
Retomar: pedir para o assistente gerar o `schema.sql`.

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
