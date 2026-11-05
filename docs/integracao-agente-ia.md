# Integração do Send Inteligentte com o agente de IA

Guia para o time do agente de vendas (Python). O Send continua sendo o dono do número na Meta: ele recebe o webhook da Meta, grava a conversa, cuida de opt-out, das campanhas e do Live Chat. O agente **não** se conecta à Meta. Ele recebe os eventos do Send e responde pela API pública do Send.

```
Lead ──WhatsApp──▶ Meta ──webhook──▶ Send ──evento (webhook ou /events)──▶ Agente
Lead ◀──WhatsApp── Meta ◀──────────── Send ◀──POST /api/v1/messages/text── Agente
```

> Não aponte o webhook da Meta direto para o agente. O Send deixaria de receber os status das campanhas, os opt-outs e o histórico do Live Chat desse número.

## 1. Configurar no painel do Send

1. **API Pública → Nova Chave**: crie uma chave (ex.: "Agente de vendas"). Ela é exibida uma única vez. No agente: `SEND_API_KEY=sk_...`.
2. **API Pública → Agente de IA**: marque "Enviar as mensagens recebidas deste número para o agente".
   - **Agente rodando localmente** (sem endereço público): deixe a URL vazia e salve. O agente busca os eventos em `GET /api/v1/events` (seção 4).
   - **Agente na VPS**: preencha a URL HTTPS do agente (ex.: `https://agente.suaempresa.com.br/webhooks/send`) e salve.
3. Na primeira ativação o painel mostra o **segredo de assinatura** (`whsec_...`) uma única vez. No agente: `SEND_WEBHOOK_SECRET=whsec_...`. Se perder, use "Novo segredo".
4. Com a URL configurada, use **Testar webhook**: o Send envia um evento `ping` assinado e mostra se o agente respondeu 2xx.

URL base da API: `https://whatsapp-api-oficial-nls9.onrender.com/api/v1`. Todas as chamadas usam `Authorization: Bearer sk_...`. Limite: 300 requisições por minuto por chave (configurável no servidor por `PUBLIC_API_RATE_LIMIT`).

## 2. Eventos

Todo evento tem o mesmo envelope, tanto no webhook quanto em `/events`:

```json
{
  "id": "1f6c...uuid",
  "seq": 1042,
  "type": "message.received",
  "version": 1,
  "createdAt": "2026-11-05T18:02:11.120Z",
  "data": { "...": "conforme o tipo" }
}
```

- `id` é único: use para **ignorar duplicados** (o webhook pode chegar mais de uma vez em caso de nova tentativa).
- `seq` é crescente por instalação: é o cursor de `/events`.
- Eventos do **mesmo contato** são entregues na ordem de `seq`: o próximo só sai depois que o anterior foi aceito (ou desistido).
- **Rajadas**: quando o lead manda várias mensagens no mesmo segundo, a Meta pode entregá-las ao Send fora de ordem. Faça o agente **agrupar as mensagens do mesmo contato por 3 a 5 segundos** antes de responder e ordenar por `message.sentAt` (horário de envio segundo a Meta). Isso também evita responder a cada linha separadamente.

### `message.received`

Uma mensagem do lead. Não é enviado quando a integração está desligada, quando o contato está na lista negra ou quando um atendente humano assumiu a conversa (seção 5).

```json
{
  "account": { "id": "4d7429d1-...", "name": "Whatsapp Inteligentte Lab", "phoneNumberId": "1142196432313568" },
  "contact": { "phone": "5583999990001", "name": "Maria", "optedOut": false },
  "message": {
    "id": "id-interno-do-send",
    "wamid": "wamid.HBgN...",
    "type": "text",
    "text": "Quero saber mais",
    "button": null,
    "mediaId": null,
    "mimeType": null,
    "replyToWamid": "wamid.HBgN... (mensagem do Send que o lead respondeu, se houver)",
    "sentAt": "2026-11-05T18:02:09.000Z",
    "receivedAt": "2026-11-05T18:02:10.000Z"
  },
  "origin": {
    "campaignId": "3a8bea91-...",
    "campaignName": "Send_Inteligentte",
    "templateName": "send_inteligentte_novembro",
    "sentAt": "2026-11-03T16:00:02.125Z"
  },
  "conversation": { "windowExpiresAt": "2026-11-06T18:02:10.000Z" }
}
```

- `message.type`: `text`, `button` (clique em botão de template), `interactive` (clique em botão enviado pelo agente), `audio`, `image`, `video`, `document`, `sticker`, `location`, `contacts`, `reaction`...
- `message.button`: em `button`/`interactive`, `{ "text": "Quero sim", "payload": "id-do-botão" }`. Nos botões que o agente envia, `payload` é o `id` que ele escolheu.
- `message.sentAt`: quando o lead enviou, segundo a Meta (precisão de segundos). `receivedAt` é quando o Send recebeu.
- `message.mediaId`: em áudio, imagem, vídeo e documento. Baixe em `GET /api/v1/media/{mediaId}` (seção 3).
- `contact.optedOut: true`: o lead pediu para sair (ex.: "SAIR", "parar") ou já estava em opt-out. **Não responda**: a API recusa com `OPT_OUT`.
- `origin`: a última campanha do Send que falou com esse número nos últimos 30 dias (`null` se não veio de campanha). Use para saber de qual oferta o lead veio.
- `conversation.windowExpiresAt`: até quando o agente pode responder com texto livre (janela de 24h da Meta).

### `conversation.handover`

Um humano assumiu a conversa, ou o próprio agente pediu um humano. **Pare de responder esse contato** até receber uma nova `message.received` dele.

```json
{
  "contact": { "phone": "5583999990001" },
  "handover": {
    "by": "human",
    "userName": "Ana (atendente)",
    "reason": null,
    "pausedAt": "2026-11-05T18:10:00.000Z",
    "resumesAt": "2026-11-06T18:10:00.000Z"
  }
}
```

### `ping`

Enviado pelo botão "Testar webhook". Responda 2xx.

## 3. API para o agente

| Método | Rota | Uso |
|---|---|---|
| `POST` | `/messages/text` | Responder com texto ou até 3 botões (janela de 24h) |
| `GET` | `/conversations/{phone}` | Estado: janela, pausa humana, opt-out, campanha de origem |
| `GET` | `/conversations/{phone}/messages?limit=30` | Histórico recente (mais antigas primeiro) |
| `POST` | `/conversations/{phone}/handover` | Pedir um atendente humano |
| `GET` | `/media/{mediaId}` | Baixar mídia recebida (ex.: áudio para transcrever) |
| `GET` | `/events?after={seq}&limit=50` | Ler eventos sem webhook |
| `POST` | `/send` | Template (fora da janela de 24h ou primeiro contato) |

### `POST /api/v1/messages/text`

```json
{ "to": "5583999990001", "text": "Perfeito! Qual o tamanho da sua equipe?", "replyToWamid": "wamid.HBgN..." }
```

Com botões (até 3; `title` até 20 caracteres; texto até 1024):

```json
{
  "to": "5583999990001",
  "text": "Quantas mensagens vocês disparam por mês?",
  "buttons": [
    { "id": "vol_ate_1k", "title": "Até 1 mil" },
    { "id": "vol_1k_10k", "title": "1 mil a 10 mil" },
    { "id": "vol_10k_mais", "title": "Mais de 10 mil" }
  ]
}
```

Resposta `201`: `{ "id", "wamid", "to", "status": "SENT", "createdAt" }`. A mensagem aparece no Live Chat como enviada por "Agente IA".

Erros que o agente deve tratar:

| HTTP | `code` | O que fazer |
|---|---|---|
| 400 | `INVALID_BODY` | Corrigir o corpo |
| 409 | `HUMAN_HANDOVER` | Um humano assumiu: não responder |
| 422 | `OUTSIDE_WINDOW` | Passou de 24h da última mensagem do lead: só template (`POST /send`) |
| 422 | `OPT_OUT` / `BLACKLISTED` | Não falar mais com esse contato |
| 429 | `RATE_LIMITED` | Esperar e tentar de novo |
| 502 | `META_ERROR` | A Meta recusou; veja `metaCode` e `details` |

### `POST /api/v1/conversations/{phone}/handover`

```json
{ "reason": "Lead pediu proposta personalizada" }
```

Pausa o agente para o contato e devolve a conversa para "Aguardando resposta" no Live Chat, onde a equipe vê o motivo.

## 4. Agente rodando localmente: leitura por `/events`

Sem endereço público, o agente consulta os eventos periodicamente. Guarde o `nextAfter` e passe em `after` na próxima chamada.

```python
import os, time, requests

BASE = "https://whatsapp-api-oficial-nls9.onrender.com/api/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['SEND_API_KEY']}"}

def poll_forever(handle_event, cursor_file="send_cursor.txt"):
    after = int(open(cursor_file).read()) if os.path.exists(cursor_file) else 0
    while True:
        r = requests.get(f"{BASE}/events", params={"after": after, "limit": 50}, headers=HEADERS, timeout=15)
        r.raise_for_status()
        body = r.json()
        for event in body["events"]:
            handle_event(event)            # mesmo formato do webhook
            after = event["seq"]
            open(cursor_file, "w").write(str(after))
        if not body["hasMore"]:
            time.sleep(3)
```

Os eventos ficam disponíveis por 7 dias. Na primeira execução use o `seq` do evento mais recente se não quiser processar o histórico.

## 5. Atendimento humano (handover)

- Quando um atendente responde pelo Live Chat, o agente é **pausado** para aquele contato e recebe `conversation.handover` com `by: "human"`.
- Enquanto pausado, as mensagens do lead não são enviadas ao agente e `POST /messages/text` responde `409 HUMAN_HANDOVER`.
- A pausa termina quando:
  - o atendente clica em **"Devolver ao agente"** na conversa, ou
  - passam **24h** sem o atendente responder (configurável no servidor por `AGENT_PAUSE_HOURS`). A próxima mensagem do lead volta para o agente.
- O agente pode pedir um humano com `POST /conversations/{phone}/handover`.

## 6. Webhook na VPS (Hostinger)

O Send faz `POST` na URL configurada com:

| Header | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `X-Send-Event` | tipo do evento |
| `X-Send-Event-Id` | id do evento |
| `X-Send-Timestamp` | segundos desde 1970 |
| `X-Send-Signature` | `sha256=` + HMAC-SHA256(segredo, `"{timestamp}.{corpo bruto}"`) em hex |

Regras:

- Responda **2xx em até 10 segundos** e processe a mensagem em segundo plano (fila/tarefa). Se demorar, o Send considera falha.
- Sem 2xx, o Send tenta de novo após 10s, 30s, 2min, 10min, 30min e 1h (7 tentativas). Depois desiste, mas o evento continua em `/events`.
- Valide a assinatura **sobre o corpo bruto** (antes de fazer parse do JSON) e rejeite timestamps com mais de 5 minutos de diferença.

Exemplo com FastAPI:

```python
import hmac, hashlib, os, time
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks

app = FastAPI()
SECRET = os.environ["SEND_WEBHOOK_SECRET"].encode()
seen_ids: set[str] = set()  # em produção, use Redis/banco

def valid_signature(raw: bytes, timestamp: str, signature: str) -> bool:
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > 300:
        return False
    expected = "sha256=" + hmac.new(SECRET, f"{timestamp}.".encode() + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")

@app.post("/webhooks/send")
async def send_webhook(request: Request, background: BackgroundTasks):
    raw = await request.body()
    if not valid_signature(raw, request.headers.get("X-Send-Timestamp", ""), request.headers.get("X-Send-Signature", "")):
        raise HTTPException(status_code=401, detail="assinatura inválida")
    event = await request.json()
    if event["id"] in seen_ids:
        return {"ok": True, "duplicate": True}
    seen_ids.add(event["id"])
    background.add_task(handle_event, event)  # responde já; processa depois
    return {"ok": True}

def handle_event(event: dict):
    if event["type"] == "message.received":
        data = event["data"]
        if data["contact"]["optedOut"]:
            return
        ...  # qualificar o lead e responder com POST /api/v1/messages/text
    elif event["type"] == "conversation.handover":
        ...  # marcar o lead como "com humano" e parar de responder
```

Checklist da VPS:

- **Domínio + HTTPS**: aponte um subdomínio (ex.: `agente.suaempresa.com.br`) para o IP da VPS e use Caddy (HTTPS automático) ou Nginx + Certbot na frente do app Python (Uvicorn/Gunicorn).
- **Processo sempre ativo**: systemd, Docker com `restart: unless-stopped` ou PM2.
- **Firewall**: libere apenas 80/443 (e SSH). O app Python escuta só em `127.0.0.1`.
- **Segredos** (`SEND_API_KEY`, `SEND_WEBHOOK_SECRET`, chave da OpenAI etc.) em variáveis de ambiente, fora do repositório.
- Depois do deploy: cadastre a URL no painel, clique em **Testar webhook** e mande uma mensagem real de um número da equipe.
