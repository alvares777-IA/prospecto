# Migração para Meta WhatsApp Cloud API

## Por que migrar

O Baileys (usado pelo Evolution API no modo atual) é uma biblioteca não oficial que
emula o WhatsApp Web. O WhatsApp detecta esse acesso e exibe a mensagem
"Aguardando mensagem. Essa ação pode levar alguns instantes" no celular dos
destinatários, além de risco real de banimento do número a qualquer momento.

A Meta Cloud API é a interface oficial. Mensagens chegam normalmente, sem avisos,
sem risco de banimento.

---

## Visão geral da arquitetura após migração

```
n8n (disparo)
    └─► Evolution API  [modo: Cloud API]
            └─► Meta Cloud API (servidores da Meta)
                    └─► WhatsApp do lead

WhatsApp do lead (resposta)
    └─► Meta Cloud API
            └─► Evolution API (webhook recebido)
                    └─► n8n (workflow de recebimento)
```

O Evolution API permanece no stack — só muda o modo de conexão de
**Baileys → Cloud API**. Todo o restante (n8n, leads-app, banco) permanece igual.

---

## Pré-requisitos

### 1. Número de telefone dedicado
- Precisa ser um número que **não esteja ativo** em nenhuma conta WhatsApp pessoal
  ou Business no momento do cadastro
- Opções: chip novo de qualquer operadora, número VoIP (ex.: Vivo Empresas, TIM
  Business, ou serviços como Twilio, Virtual Phone)
- O número pode ser brasileiro (+55)

### 2. Conta no Meta Business Manager
- Acessar: business.facebook.com
- Criar ou usar uma conta Business existente
- Associar ao CNPJ da empresa (necessário para verificação)

### 3. App na Meta for Developers
- Acessar: developers.facebook.com
- Criar um App do tipo **Business**
- Adicionar o produto **WhatsApp** ao app
- Isso gera o `PHONE_NUMBER_ID` e o `ACCESS_TOKEN` permanente

### 4. Verificação do negócio na Meta
- Submeter documentos do CNPJ no Business Manager
- Prazo: geralmente 1–5 dias úteis
- Necessário para enviar mensagens em volume (sem verificação, limite de 250
  conversas/dia)

---

## Etapas da migração

### Etapa 1 — Configurar o App na Meta (≈ 1h + tempo de aprovação)

1. Criar App em developers.facebook.com → tipo Business
2. Adicionar produto WhatsApp
3. Cadastrar o número dedicado
   - Meta envia código de verificação por SMS ou voz
4. Gerar token de acesso permanente (System User com permissão `whatsapp_business_messaging`)
5. Anotar:
   - `PHONE_NUMBER_ID`
   - `WABA_ID` (WhatsApp Business Account ID)
   - `ACCESS_TOKEN`

### Etapa 2 — Criar e aprovar templates de mensagem (1–3 dias úteis)

Templates são obrigatórios para a **primeira mensagem** a um contato (janela fechada).
Após o lead responder qualquer coisa, a janela de 24h abre e mensagens livres são
permitidas.

**Template proposto para disparo inicial:**

```
Nome: prospecto_apresentacao
Idioma: Português (BR)
Categoria: MARKETING

Corpo:
Olá {{1}}, tudo bem?
Temos uma solução para seu condomínio. Posso te apresentar em 2 minutos?
```

- Variável `{{1}}` = nome do lead (vem do banco)
- Submeter no Meta Business Manager → WhatsApp → Message Templates
- Aguardar aprovação (geralmente automática em minutos, mas pode levar até 3 dias)

**Templates adicionais recomendados:**
- Template de follow-up (para leads que não responderam após 48h)
- Template de encerramento ("Encerrando nosso contato, qualquer dúvida estamos à disposição")

### Etapa 3 — Reconfigurar o Evolution API (≈ 30min)

No `docker-compose.yml`, adicionar as variáveis para modo Cloud API:

```yaml
# Habilitar modo Cloud API
WHATSAPP_CLOUD_API_ENABLED: "true"

# Credenciais da Meta
WA_CLOUD_PHONE_NUMBER_ID: ${WA_PHONE_NUMBER_ID}
WA_CLOUD_ACCESS_TOKEN: ${WA_ACCESS_TOKEN}
WA_CLOUD_WABA_ID: ${WA_WABA_ID}
```

Criar nova instância no Evolution API do tipo `cloud` (em vez de `baileys`):

```bash
POST /instance/create
{
  "instanceName": "prospecto-cloud",
  "integration": "WHATSAPP-CLOUD",
  "token": "...",
  "phoneNumberId": "...",
  "wabaId": "...",
  "accessToken": "..."
}
```

A instância Baileys (`prospecto-wa`) pode coexistir durante a transição.

### Etapa 4 — Atualizar workflow n8n de disparo (≈ 1h)

A mudança principal é no nó **"Enviar Mensagem"**: em vez de enviar texto livre,
enviar via template.

**Endpoint muda de:**
```
POST /message/sendText/prospecto-wa
{ "number": "...", "text": "..." }
```

**Para:**
```
POST /message/sendTemplate/prospecto-cloud
{
  "number": "...",
  "template": {
    "name": "prospecto_apresentacao",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "{{nome do lead}}" }
        ]
      }
    ]
  }
}
```

O restante do workflow (Buscar Lead, Salvar JID, Marcar Contactado) permanece igual.

### Etapa 5 — Atualizar webhook de recebimento (≈ 30min)

O formato do payload do webhook da Cloud API é diferente do Baileys. O nó
**"Processar Mensagem"** precisará ser atualizado para ler a estrutura da Meta.

Estrutura do webhook Cloud API:
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511917346085",
          "text": { "body": "Sim" },
          "type": "text"
        }]
      }
    }]
  }]
}
```

O campo `from` já é o número real — sem `@lid`, sem ambiguidade.

### Etapa 6 — Atualizar variáveis de ambiente (≈ 15min)

Adicionar ao `.env`:
```env
WA_PHONE_NUMBER_ID=...
WA_ACCESS_TOKEN=...
WA_WABA_ID=...
```

### Etapa 7 — Testes e cutover (≈ 2h)

1. Testar envio de template para número próprio
2. Confirmar que a mensagem chega sem aviso "Aguardando"
3. Testar resposta e fluxo inbound completo
4. Confirmar que status é atualizado para `interessado` no banco
5. Confirmar que notificação chega ao admin
6. Desativar instância Baileys (`prospecto-wa`)
7. Atualizar referências de `prospecto-wa` para `prospecto-cloud` no n8n e leads-app

---

## Custos estimados

| Item | Custo |
|---|---|
| Primeiras 1.000 conversas/mês | Grátis |
| Conversas de marketing (acima do free tier) | ~US$ 0,05–0,12 por conversa |
| Número VoIP dedicado (opcional) | ~R$ 30–80/mês |
| Chip físico dedicado | ~R$ 20 ativação + plano básico |

Uma "conversa" = janela de 24h com um contato, independente da quantidade de
mensagens trocadas. Para um volume de 1.000 leads/mês, o custo é zero.

---

## Riscos e pontos de atenção

- **Templates rejeitados:** A Meta pode rejeitar templates com linguagem muito
  comercial/agressiva. Ter 2–3 variações preparadas.
- **Janela de 24h:** Após a janela fechar, só é possível retomar contato com novo
  template. O n8n deve detectar isso e usar o template correto.
- **Número não pode estar no WhatsApp pessoal:** Se o chip já foi usado, é
  necessário desvincular primeiro (pode levar até 30 dias para liberar).
- **Verificação do negócio:** Sem verificação, o limite é 250 conversas/dia —
  suficiente para início, mas necessário verificar para escalar.

---

## Ordem de execução recomendada

```
Semana 1: Criar app Meta + cadastrar número + submeter templates
Semana 2: Aguardar aprovação de templates + configurar Evolution API modo Cloud
Semana 3: Adaptar workflows n8n + testes internos
Semana 4: Cutover — desligar Baileys, ativar Cloud API em produção
```
