# Solicitação de Configuração — Proxy OpenResty
**Projeto:** Prospecto-IA (Robô de prospecção WhatsApp)
**Data:** 2026-04-24
**Solicitante:** Alvares

---

## 1. Contexto

Estamos implantando novos serviços no servidor web interno (`web-by`, IP `192.168.210.7`).
O Apache desse servidor já está configurado e pronto para receber tráfego nos novos subdomínios.
Os certificados SSL (Let's Encrypt) já foram emitidos e estão instalados no Apache.

O que falta é o servidor proxy (`192.168.210.8`) rotear o tráfego dos novos subdomínios
para o Apache, exatamente como já faz para os domínios existentes (ex: `ruptura.rssc.com.br`).

---

## 2. Arquitetura Atual

```
Internet
    │
    ▼
200.143.179.45  ←── IP público
[OpenResty / Proxy]  ←── 192.168.210.8  ← CONFIGURAR AQUI
    │
    ▼
192.168.210.7  ←── IP interno
[Apache / web-by]  ←── já configurado e pronto
    │
    ▼
Docker containers (n8n, Evolution API, Typebot)
```

---

## 3. O que precisa ser feito

Adicionar roteamento para **4 novos subdomínios**, seguindo o mesmo padrão
dos domínios que já funcionam no proxy.

| Subdomínio | Porta interna (Apache) | Observação |
|---|---|---|
| `n8n.prospect.rssc.com.br` | 80 e 443 | Requer suporte a WebSocket |
| `api.prospect.rssc.com.br` | 80 e 443 | Evolution API |
| `bot.prospect.rssc.com.br` | 80 e 443 | Typebot Viewer |
| `builder.prospect.rssc.com.br` | 80 e 443 | Typebot Builder |

Todos devem apontar para **`192.168.210.7`** (mesmo destino do `ruptura.rssc.com.br`).

---

## 4. Configuração sugerida para o OpenResty

> **Importante:** use o mesmo padrão já adotado para `ruptura.rssc.com.br`.
> Se a configuração atual usa stream/TCP passthrough, replique esse modelo.
> Se usa proxy HTTP/HTTPS na camada 7, use o modelo abaixo.

### Modelo — Proxy HTTP (camada 7)

Criar ou adicionar em `/etc/nginx/conf.d/prospect.conf`
(ou no arquivo de configuração equivalente dos domínios existentes):

```nginx
# ── n8n (requer WebSocket) ───────────────────────────────────
server {
    listen 80;
    server_name n8n.prospect.rssc.com.br;

    location / {
        proxy_pass http://192.168.210.7:80;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name n8n.prospect.rssc.com.br;

    # SSL termina no Apache — fazer passthrough ou proxiar sem verificar cert interno
    proxy_ssl_verify off;

    location / {
        proxy_pass https://192.168.210.7:443;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# ── Evolution API ────────────────────────────────────────────
server {
    listen 80;
    server_name api.prospect.rssc.com.br;

    location / {
        proxy_pass http://192.168.210.7:80;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.prospect.rssc.com.br;

    proxy_ssl_verify off;

    location / {
        proxy_pass https://192.168.210.7:443;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# ── Typebot Viewer ───────────────────────────────────────────
server {
    listen 80;
    server_name bot.prospect.rssc.com.br;

    location / {
        proxy_pass http://192.168.210.7:80;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name bot.prospect.rssc.com.br;

    proxy_ssl_verify off;

    location / {
        proxy_pass https://192.168.210.7:443;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# ── Typebot Builder ──────────────────────────────────────────
server {
    listen 80;
    server_name builder.prospect.rssc.com.br;

    location / {
        proxy_pass http://192.168.210.7:80;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name builder.prospect.rssc.com.br;

    proxy_ssl_verify off;

    location / {
        proxy_pass https://192.168.210.7:443;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Modelo alternativo — TCP Passthrough / Stream (camada 4)

Se o proxy usa o módulo `stream` do nginx para repassar SSL sem terminar:

```nginx
stream {
    map $ssl_preread_server_name $backend {
        n8n.prospect.rssc.com.br       192.168.210.7:443;
        api.prospect.rssc.com.br       192.168.210.7:443;
        bot.prospect.rssc.com.br       192.168.210.7:443;
        builder.prospect.rssc.com.br   192.168.210.7:443;
    }

    server {
        listen      443;
        proxy_pass  $backend;
        ssl_preread on;
    }
}
```

---

## 5. Verificação após configurar

Após aplicar e recarregar o OpenResty (`nginx -s reload`), validar cada subdomínio:

```bash
curl -I https://n8n.prospect.rssc.com.br
curl -I https://api.prospect.rssc.com.br
curl -I https://bot.prospect.rssc.com.br
curl -I https://builder.prospect.rssc.com.br
```

Esperado: resposta HTTP `200` ou `302` — qualquer coisa que **não** seja o erro
`404` do OpenResty padrão indica que o roteamento está funcionando.

Os containers Docker ainda não estão rodando no momento da configuração —
é normal receber `502 Bad Gateway` do Apache. O importante é que a resposta
venha do Apache (sem o footer `openresty` do proxy padrão).

---

## 6. Referência — domínio existente que já funciona

`ruptura.rssc.com.br` → `192.168.210.7` já está configurado e funcionando.
Replicar exatamente o mesmo padrão usado para esse domínio é suficiente.

---

## 7. Contato para dúvidas

Alvares — alvares777@gmail.com
