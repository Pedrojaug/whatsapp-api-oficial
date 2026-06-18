# Send Inteligentte

Plataforma SaaS multi-tenant para disparo em massa e automação de mensagens WhatsApp via **Meta WhatsApp Business Cloud API v19**.

---

## Principais Funcionalidades

- **Login & Multi-Tenant** — isolamento total de dados entre contas; cada conta representa um número WhatsApp Business. Sessões por JWT (30 dias).
- **Modo Suporte (Impersonação)** — administradores `SUPERUSER` entram em qualquer conta de cliente para prestar suporte, com banner de aviso visual.
- **Wizard de Pareamento Meta** — conexão via OAuth do Facebook Login ou configuração manual das chaves da API.
- **Construtor de Templates** — criação com cabeçalhos de mídia (imagem/vídeo), variáveis dinâmicas, rodapé e botões CTA; simulador de WhatsApp em tempo real.
- **Campanhas** — disparo em lote para listas de contatos com variáveis dinâmicas (`CONTACT_NAME`, `CONTACT_PHONE`, `CONTACT_VAR_1/2/3`); suporte a campanhas únicas e recorrentes (diária, semanal, mensal).
- **Listas de Contatos** — importação CSV com detecção automática de colunas, tags e segmentação.
- **Opt-out LGPD** — detecção automática via webhook (palavras-chave como "SAIR", "PARAR") + gestão manual; disparos bloqueados automaticamente para contatos opt-out.
- **Rastreamento de Links** — URLs encurtadas com contagem de cliques em tempo real para uso nos disparos.
- **API Pública** — chaves `sk_...` com autenticação Bearer e rate limit de 60 req/min; permite disparos programáticos sem login.
- **Relatórios** — painel de métricas com gráficos por período e exportação XLSX do histórico de envios.
- **Real-time** — atualizações de status de mensagens via Server-Sent Events (SSE).
- **Persistência de Mídias** — arquivos armazenados em Postgres (Base64) e restaurados automaticamente em caso de reinício do servidor (necessário no Render free tier).

---

## Arquitetura

### Padrão Transactional Outbox

Mensagens nunca são enviadas inline. A API cria um registro `Message` com `status: PENDING` e um worker em background processa a fila a cada 5 segundos:

```
POST /api/.../messages
        ↓
  Message { status: PENDING }
        ↓
  dispatcher.ts (poll 5 s)
        ↓
  graph.facebook.com/v19.0/{phoneId}/messages
        ↓
  SENT | FAILED (retry exponencial: 1 min → 5 min → 15 min)
```

### Fluxo de requisições

```
Vercel (SPA)  →  AuthContext (JWT localStorage)
                        ↓  Authorization: Bearer <jwt>
Render (API)  →  /api/auth          — autenticação (público)
              →  /api/admin         — painel super admin (SUPERUSER)
              →  /api/v1            — API pública (Bearer sk_...)
              →  /api               — rotas autenticadas (JWT)
              →  /t/:shortCode      — redirect de links rastreados (público)
```

### Multi-tenancy

```
User → Account[] → Templates, Messages, ContactLists, Campaigns, ApiKeys, TrackedLinks, OptOuts
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js · Express · TypeScript · Prisma ORM |
| Frontend | React 19 · Vite · TypeScript |
| Banco de dados | PostgreSQL (Neon serverless) |
| Deploy backend | Render |
| Deploy frontend | Vercel |
| API de mensagens | Meta WhatsApp Business Cloud API v19 |

---

## Como Iniciar Localmente

### Backend

```bash
cd backend
npm install
```

Crie `backend/.env`:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require"
JWT_SECRET="string-aleatoria-segura"
ENCRYPTION_KEY="chave-aes-256-cbc-32-bytes-hex"
FACEBOOK_APP_ID="seu-app-id-meta"
FACEBOOK_APP_SECRET="seu-app-secret-meta"
FRONTEND_URL="http://localhost:5173"
PORT=3001
```

```bash
npx prisma db push   # sincroniza o schema (nunca usar migrate dev)
npm run dev          # inicia em :3001
```

### Frontend

```bash
cd frontend
npm install
```

Crie `frontend/.env`:

```env
VITE_API_BASE_URL="http://localhost:3001/api"
VITE_FACEBOOK_APP_ID="seu-app-id-meta"
```

```bash
npm run dev   # inicia em :5173
```

### Comandos úteis

```bash
# Backend
npm run test          # testes unitários (Vitest)
npx tsc --noEmit      # verificação de tipos sem build

# Frontend
npm run lint          # ESLint
npx tsc --noEmit      # verificação de tipos sem build
```

---

## API Pública

Autentique com `Authorization: Bearer sk_<chave>` obtida no painel em **API Pública**.

```http
POST /api/v1/send
Content-Type: application/json
Authorization: Bearer sk_...

{
  "to": "5511999999999",
  "templateName": "nome_do_template",
  "variables": ["João", "Promoção X"]
}
```

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/v1/send` | Disparar mensagem |
| `GET` | `/api/v1/messages/:id` | Consultar status |
| `GET` | `/api/v1/templates` | Listar templates aprovados |

Limite: 60 req/min por chave · Máximo 10 chaves por conta.

---

## Deploy (Render + Vercel)

| Serviço | Plataforma | Observações |
|---|---|---|
| Backend | Render (Web Service) | Variáveis de ambiente no painel Render; `npm run build && npm start` |
| Frontend | Vercel | `VITE_API_BASE_URL` aponta para o backend no Render |
| Banco | Neon | `DATABASE_URL` via connection string pooled |

O `npm run build` do backend executa `prisma db push` automaticamente a cada deploy.

### Webhooks em desenvolvimento (Ngrok)

```bash
ngrok http 3001
```

Configure no Facebook Developers:
- **URL de Retorno:** `https://<url-ngrok>/webhooks`
- **Campos de Inscrição:** `messages`

---

## Segurança

- Access tokens Meta armazenados com **AES-256-CBC**
- Senhas com **bcrypt** (salt 12)
- Chaves de API com hash **SHA-256** (nunca armazenadas em texto puro)
- Webhook Meta validado com **HMAC-SHA256** via `FACEBOOK_APP_SECRET`
- CORS dinâmico para subdomínios `*.vercel.app`
- Rate limiting global via `express-rate-limit`
