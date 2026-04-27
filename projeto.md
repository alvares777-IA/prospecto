# Projeto: Robô de Prospecção WhatsApp - Auto-Hospedado

Estou desenvolvendo um robô de prospecção para WhatsApp em um servidor Colocation usando Apache, Evolution API e n8n. Esse o documento de contexto.
Agora, me ajude a [criar o arquivo docker-compose / estruturar a tabela SQL de leads / configurar o primeiro workflow no n8n] e o que mais for necessário

## 1. Visão Geral
O objetivo é criar uma infraestrutura de prospecção automatizada para WhatsApp, rodando em servidor próprio (Colocation) com Apache como proxy reverso, utilizando ferramentas Open Source para evitar custos de API por mensagem e garantir total controle dos dados.

## 2. Contexto do Ambiente
- **Servidor:** Colocation em Datacenter.
- **SO:** Linux (gerenciamento via terminal).
- **Web Server:** Apache (configurado como Proxy Reverso).
- **Runtime:** Node.js instalado globalmente + Docker para orquestração de serviços.

## 3. Stack Tecnológica
- **Evolution API (Node.js):** Interface principal com o WhatsApp (emulação de Web).
- **n8n (Docker):** Orquestrador de workflows (substituindo o Make.com).
- **Typebot (Docker):** Construtor visual de fluxos de conversa e qualificação.
- **PostgreSQL (Docker):** Banco de dados para persistência do n8n e Typebot.
- **Banco de Dados Operacional:** postgres SQL (para gestão da lista de prospecção e status dos leads).
- **Sistema WEB para manutenção de lista de clientes.


## 4. Arquitetura de Redes e Proxy (Apache)
Os serviços serão expostos via subdomínios com SSL (Certbot):
- `n8n.prospect.rssc.com.br` -> Proxy para porta `5678` (com suporte a WebSockets).
- `api.prospect.rssc.com.br` -> Proxy para porta `8080` (Evolution API).
- `bot.prospect.rssc.com.br` -> Proxy para o visualizador do Typebot.

### Exemplo de Configuração de Proxy no Apache:
```apache
<VirtualHost *:443>
    ServerName n8n.prospect.rssc.com.br
    ProxyPass / http://127.0.0.1:5678/ upgrade=websocket
    ProxyPassReverse / http://127.0.0.1:5678/
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule .* ws://127.0.0.1:5678%{REQUEST_URI} [P,L]
    SSLEngine on
</VirtualHost>
```

## 5. Fluxo Lógico de Prospecção
1. **Fila de Disparo:** O n8n consome uma tabela SQL (leads `pending`).
2. **Envio Controlado:** Disparo via Evolution API com delay (30-90s) para evitar banimento.
3. **Webhook de Resposta:** A Evolution API notifica o n8n/Typebot sobre novas mensagens.
4. **Qualificação:** O Typebot assume a conversa se o lead responder positivamente.
5. **Transbordo:** Notificação via WhatsApp pessoal quando um lead for qualificado.

## 6. Próximos Passos Técnicos
- Configurar `docker-compose.yml` para n8n, Typebot e Postgres.
- Provisionar VirtualHosts no Apache para os novos subdomínios.
- Realizar o "aquecimento" do chip (warm-up) enviando mensagens gradualmente.
- Implementar a lógica de "Rodízio de Instâncias" (opcional, para alta escala).

---
