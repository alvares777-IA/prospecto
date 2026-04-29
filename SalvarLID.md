# Salvar @lid via recibo de entrega (MESSAGES_UPDATE)

## Problema

Quando o bot envia uma mensagem para um lead, o Evolution API retorna o JID no
formato `@s.whatsapp.net` (ex.: `5511958622505@s.whatsapp.net`). Porém, quando
o lead responde, o WhatsApp usa o formato `@lid` (ex.: `155422099009704@lid`),
que é um identificador opaco sem relação matemática com o número de telefone.

Sem o `@lid` pré-armazenado, o nó "Buscar Lead por JID" não encontra o lead na
primeira resposta e o fluxo para silenciosamente.

## Solução

Quando o bot envia uma mensagem, o WhatsApp dispara um recibo de entrega
(evento `MESSAGES_UPDATE` com `status: DELIVERY_ACK`). Esse recibo contém:
- `key.id` — ID da mensagem enviada (o mesmo retornado pelo Evolution API no envio)
- `key.remoteJid` — JID do lead, agora no formato `@lid`

Se armazenarmos o `key.id` no momento do envio, ao receber o recibo conseguimos
cruzar e salvar o `@lid` correto para aquele lead — antes de ele responder.

## Mudanças necessárias

### 1. Banco de dados — nova coluna

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message_id TEXT;
```

Adicionar à migration em `leads-app/src/db.js`.

### 2. Outbound n8n — salvar ID da mensagem

No nó **"Salvar JID"** (que já existe após "Enviar Mensagem"), adicionar o
`last_message_id` ao UPDATE:

```sql
UPDATE leads
SET whatsapp_jid    = '{{ $json.key.remoteJid }}',
    last_message_id = '{{ $json.key.id }}'
WHERE id = {{ $('Buscar Lead').item.json.id }}
```

### 3. Webhook Evolution API — assinar MESSAGES_UPDATE

Atualizar a subscrição para incluir o novo evento:

```bash
curl -X POST http://localhost:8080/webhook/set/prospecto-wa \
  -H "apikey: 2260026779083fe4f6b552c2a572f34dfb7343a4" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://n8n:5678/webhook/prospecto-inbound",
      "byEvents": false,
      "base64": false,
      "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"]
    }
  }'
```

### 4. Code node "Processar Mensagem" — tratar os dois eventos

Substituir o código atual pelo abaixo, que distingue três casos:

```javascript
const body = $input.first().json.body;
const event = body.event || '';

// ── Recibo de entrega: capturar @lid ──────────────────────────────────────
if (event === 'messages.update') {
  const updates = Array.isArray(body.data) ? body.data : [];
  for (const upd of updates) {
    const jid = upd.key?.remoteJid || '';
    if (upd.key?.fromMe && jid.endsWith('@lid') && upd.key?.id) {
      return [{ json: { _tipo: 'salvar_lid', message_id: upd.key.id, lid: jid } }];
    }
  }
  return []; // ignorar outros updates
}

// ── Mensagem recebida do lead ─────────────────────────────────────────────
const fromMe = body.data?.key?.fromMe ?? true;
const text   = (
  body.data?.message?.conversation ||
  body.data?.message?.extendedTextMessage?.text ||
  ''
).trim();
const jid = body.data?.key?.remoteJid || '';

if (event !== 'messages.upsert' || fromMe || !text) return [];

const keywords = ['ok', 'sim', 'quero', 'pode ser', 'tenho interesse',
                  'tudo bem', 'oi', 'olá', 'ola'];
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isPositive = keywords.some(k => norm(text).includes(norm(k)));
const rota = isPositive ? 'interessado' : 'sem_interesse';

return [{ json: { _tipo: 'mensagem', jid, text, rota } }];
```

### 5. Switch no início do fluxo de recebimento

Logo após "Processar Mensagem", adicionar um Switch pelo campo `_tipo`:

```
Processar Mensagem → Switch (_tipo)
    ├─ salvar_lid → [Postgres] Salvar LID por message_id
    └─ mensagem   → Buscar Lead por JID → Salvar LID → Switch (rota) → ...
```

**Nó "Salvar LID por message_id" (Postgres):**

```sql
UPDATE leads
SET whatsapp_lid = '{{ $json.lid }}'
WHERE last_message_id = '{{ $json.message_id }}'
AND whatsapp_lid IS NULL
```

### 6. Fluxo completo após implementação

```
Webhook → Processar Mensagem → Switch (_tipo)
              │
              ├─ salvar_lid ──────────────────────────────► Salvar LID por message_id
              │
              └─ mensagem → Buscar Lead por JID → Salvar LID → Switch (rota)
                                                                   ├─ interessado   → Marcar Interessado → Notificar Admin
                                                                   └─ sem_interesse → Marcar Sem Interesse → Notificar Admin Resposta
```

## Resultado esperado

1. Bot envia mensagem para Natã (`5511958622505`) → salva `last_message_id`
2. WhatsApp entrega a mensagem → dispara `MESSAGES_UPDATE` com `155422099009704@lid`
3. n8n captura e salva `whatsapp_lid = '155422099009704@lid'` no lead do Natã
4. Natã responde → `Buscar Lead por JID` encontra pelo `whatsapp_lid` → fluxo completo

## Observação

Esta solução resolve o problema para o Baileys (Evolution API modo atual).
Após a migração para a Meta Cloud API (ver `migrar_MetaCloudAPI.md`), o `@lid`
deixa de existir — a API oficial retorna sempre o número de telefone real.
Esta implementação pode ser descartada após a migração.
