---
name: prospecto-ia-infra-access
description: "Acessos aos sistemas de infraestrutura do datacenter usados pelo PROSPECTO-IA (Nginx Proxy Manager, servidor web-by, Cloudflare)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 7ce7da2f-2c11-442c-aa14-5846a94c68c6
  modified: 2026-09-29T21:33:14.327Z
---

Infraestrutura do PROSPECTO-IA roda em dois servidores internos do datacenter RSSC, atrás de Cloudflare (DNS only) → proxy → Apache → Docker.

- **Servidor proxy (Nginx Proxy Manager)** — IP `192.168.210.8`, senha de acesso ao servidor: `lx1294`. Só acessível via VPN da RSSC. Painel web do NPM em `http://192.168.210.8:81/`, login `Marcelo Alvares` / `sistemacerto@rssc.com.br` — senha não decorada, fica salva no navegador Edge da máquina que acessa lá. É aqui que se cadastra cada novo subdomínio como "Proxy Host" — passo obrigatório antes de rodar certbot no Apache, ver [[prospecto-ia-datacenter-deploy]].
- **Servidor Apache/Docker (web-by)** — IP `192.168.210.7`. Stack docker-compose roda em `/home/producao/prospecto/` (usuário `producao`; comandos que tocam `/etc/httpd` ou `/etc/letsencrypt` precisam de `sudo`).
- **Cloudflare** (DNS dos domínios `rssc.com.br` / `prospect.rssc.com.br`) — `https://dash.cloudflare.com/3e9219fe70b16c134db8e61f1276dfe8/home`.
- IP público de saída de todos os subdomínios do stack: `200.143.179.45`.
