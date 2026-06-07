# Manual Completo do Desenvolvedor: Send Inteligentte

Este manual destina-se a engenheiros e desenvolvedores que assumirão a manutenção ou expansão da plataforma **Send Inteligentte**. Ele descreve detalhadamente a estrutura de pastas, fluxos de dados, configurações de ambiente, esquema de banco de dados, assinaturas completas de API (com exemplos de payload) e fluxos assíncronos chaves do sistema.

---

## 🔄 1. Fluxo de Dados e Arquitetura Geral

O fluxo de dados da aplicação funciona de forma integrada entre o painel de controle do usuário, o backend interceptador e a API da Meta:

```mermaid
graph TD
  User([Usuário / Navegador]) -->|"1. Interage / Solicita"| FE[Frontend - Vite/React/TS]
  FE -->|"2. Requisições Axios com Bearer JWT"| BE[Backend - Node/Express/TS]
  BE -->|"3. Persistência e Consultas Prisma"| DB[("Banco de Dados - Neon Postgres")]
  BE <-->|"4. Credenciais, Disparos e Mídias"| MetaAPI[Meta Graph API]
  MetaAPI -->|"5. Status Webhook Events (sent, delivered, read, failed)"| BE
```

---

## 📁 2. Estrutura Completa de Diretórios

O projeto está organizado no modelo de monorrepositório simplificado contendo duas aplicações TypeScript desacopladas:

```text
├── backend/
│   ├── prisma/
│   │   └── schema.prisma           # Schema declarativo do banco de dados (Neon Postgres)
│   ├── src/
│   │   ├── middlewares/
│   │   │   └── auth.ts             # Middleware de autenticação JWT e Scoping
│   │   ├── routes/
│   │   │   ├── admin.ts            # Rotas administrativas e impersonação
│   │   │   ├── auth.ts             # Registro, login e validações JWT
│   │   │   └── whatsapp.ts         # Contas Meta, templates, listas, webhook e disparos
│   │   ├── db.ts                   # Inicializador singleton do PrismaClient
│   │   └── server.ts               # Ponto de entrada do servidor Express e CORS
│   ├── tsconfig.json               # Configurações do compilador TypeScript (Node)
│   ├── package.json
│   └── seed_metrics.js             # Script utilitário para povoar dados analíticos de teste
│
├── frontend/
│   ├── public/
│   │   ├── oauth_callback.html     # Callback do pop-up do Facebook OAuth (postMessage)
│   │   └── favicon.svg             # Logotipo e favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthPages.tsx       # Interfaces de login, registro e animações
│   │   │   ├── PhoneSimulator.tsx  # Simulador interativo do WhatsApp em CSS puro
│   │   │   └── SetupWizard.tsx     # Wizard passo a passo para pareamento (OAuth/Manual)
│   │   ├── App.tsx                 # Core da aplicação (rotas, abas, painéis e Axios interceptors)
│   │   ├── index.css               # Design system global (Tokens CSS, Glassmorphism, Utilities)
│   │   └── main.tsx                # Ponto de entrada do React
│   ├── tsconfig.json               # Configurações do compilador TypeScript (React/Vite)
│   └── package.json
```

---

## ⚙️ 2. Variáveis de Ambiente e Configuração

Ambas as aplicações necessitam de arquivos `.env` na raiz de suas respectivas pastas.

### 🔌 Backend (`backend/.env`)
```env
# URL de conexão segura com o Neon Postgres (Pooling ou Direct)
DATABASE_URL="postgresql://pedro:password@ep-cool-forest.us-east-2.aws.neon.tech/send_inteligentte?sslmode=require"

# Chave simétrica usada para assinar e decodificar os tokens JWT
JWT_SECRET="minha-chave-secreta-super-segura-do-hub"

# Porta onde o servidor Express rodará localmente
PORT=3001

# Chaves de Integração do Aplicativo Meta (usadas para trocar tokens no Facebook Onboarding)
FACEBOOK_APP_ID="1395411182414690"
FACEBOOK_APP_SECRET="c080cbb2250814f849cdcc5236ad6a85"

# Token cadastrado na Meta para validação inicial de handshake do Webhook
WEBHOOK_VERIFY_TOKEN="minha-senha-super-secreta-do-webhook"
```

### 💻 Frontend (`frontend/.env`)
```env
# Endereço base do backend local ou em produção
VITE_API_BASE_URL="http://localhost:3001/api"

# ID do Aplicativo Meta cadastrado para disparar o login pop-up do Facebook
VITE_FACEBOOK_APP_ID="1395411182414690"
```

## 🗄️ 3. Dicionário de Dados (Neon Postgres via Prisma)

Para enxergar e compreender a arquitetura e conexões das entidades no banco de dados, utilize o diagrama ER de relacionamentos abaixo:

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : "possui"
  ACCOUNT ||--o{ TEMPLATE : "gerencia"
  ACCOUNT ||--o{ MESSAGE : "dispara"
  ACCOUNT ||--o{ CONTACT_LIST : "cadastra"
  CONTACT_LIST ||--o{ CONTACT : "contém"

  USER {
    string id PK
    string email UK
    string password
    string name
    string role "SUPERUSER | USER"
  }

  ACCOUNT {
    string id PK
    string name
    string wabaId
    string phoneNumberId
    string accessToken
    string userId FK
  }

  TEMPLATE {
    string id PK
    string metaId UK
    string name
    string language
    string category
    string status "PENDING | APPROVED | REJECTED"
    json components
    string accountId FK
  }

  MESSAGE {
    string id PK
    string wamid UK
    string to
    string status "PENDING | SENT | DELIVERED | READ | FAILED"
    string errorMessage
    string templateName
    json variables
    string accountId FK
  }

  CONTACT_LIST {
    string id PK
    string name
    string accountId FK
  }

  CONTACT {
    string id PK
    string name
    string phone
    json variables
    string contactListId FK
  }
```

---

### Tabela: `User`
Armazena credenciais e permissões de acesso ao painel.
- `id` (String, PK, UUID): Identificador único do usuário.
- `email` (String, Unique): E-mail de login.
- `password` (String): Hash da senha criptografado com `bcryptjs` (salt rounds = 10).
- `name` (String, Opcional): Nome de exibição.
- `role` (String, Default: `"USER"`): `"USER"` para clientes ou `"SUPERUSER"` para administradores.

### Tabela: `Account`
Configurações de integração de canais da API Oficial.
- `id` (String, PK, UUID): Identificador único da conta.
- `name` (String): Nome personalizado do canal.
- `wabaId` (String): WhatsApp Business Account ID.
- `phoneNumberId` (String): Phone Number ID (identificador do número de telefone).
- `accessToken` (String): Token de acesso (temporário de 24h ou permanente do Sistema).
- `userId` (String, FK -> `User`): Usuário proprietário do canal.
- *Unique Constraint:* `@@unique([userId, name])` - impede que o mesmo usuário cadastre duas contas com o mesmo nome.

### Tabela: `Template`
Armazena a estrutura local dos templates de mensagens importados ou criados.
- `id` (String, PK, UUID).
- `metaId` (String, Unique, Opcional): ID de controle retornado pela Meta API.
- `name` (String): Nome identificador do template (ex: `boas_vindas`).
- `language` (String, Default: `"pt_BR"`): Idioma do template.
- `category` (String): Categoria do template (ex: `UTILITY`, `MARKETING`).
- `status` (String, Default: `"PENDING"`): Status aprovado pela Meta (`PENDING`, `APPROVED`, `REJECTED`).
- `components` (Json): Objeto contendo os blocos do template (cabeçalho, corpo, rodapé e botões).
- `accountId` (String, FK -> `Account`): Conta vinculada.
- *Unique Constraint:* `@@unique([accountId, name])`.

### Tabela: `Message`
Logs detalhados de disparos efetuados.
- `id` (String, PK, UUID).
- `wamid` (String, Unique, Opcional): ID da mensagem retornado pela Meta (usado para conciliar webhooks).
- `to` (String): Número de telefone do destinatário (ex: `5511999999999`).
- `status` (String, Default: `"PENDING"`): Status de entrega (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- `errorMessage` (String, Opcional): Detalhe técnico da falha no envio.
- `templateName` (String): Nome do template associado.
- `variables` (Json, Opcional): Parâmetros dinâmicos utilizados no preenchimento.
- `accountId` (String, FK -> `Account`).

### Tabela: `ContactList`
Listas importadas de contatos.
- `id` (String, PK, UUID).
- `name` (String): Nome descritivo da lista.
- `accountId` (String, FK -> `Account`).
- *Unique Constraint:* `@@unique([accountId, name])`.

### Tabela: `Contact`
Contatos individuais contidos nas listas.
- `id` (String, PK, UUID).
- `name` (String, Opcional): Nome do contato.
- `phone` (String): Telefone limpo para disparo.
- `variables` (Json, Opcional): Array de valores das colunas extras importadas do CSV (mapeamento posicional).
- `contactListId` (String, FK -> `ContactList`).

---

## 📡 4. Especificações da API REST

Todas as rotas (exceto as de webhook e autenticação pública) exigem o cabeçalho:
`Authorization: Bearer <TOKEN_JWT_VALIDO>`

### 🔐 Módulo de Autenticação (`/api/auth`)

#### `POST /api/auth/register`
Cadastra um novo usuário.
- **Request Body:**
  ```json
  {
    "email": "dev@test.com",
    "password": "password123",
    "name": "Developer Test"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "7f8a9b...",
      "email": "dev@test.com",
      "name": "Developer Test",
      "role": "USER"
    }
  }
  ```

#### `POST /api/auth/login`
Autenticação de usuário.
- **Request Body:**
  ```json
  {
    "email": "dev@test.com",
    "password": "password123"
  }
  ```
- **Response (200 OK):** Retorna o mesmo payload de sucesso do `/register`.

---

### 🛠️ Módulo de Administração & Modo Suporte (`/api/admin`)

#### `GET /api/admin/users`
Lista todos os usuários do sistema. Acesso restrito a `SUPERUSER`.
- **Response (200 OK):**
  ```json
  [
    {
      "id": "7f8a9b...",
      "email": "dev@test.com",
      "name": "Developer Test",
      "role": "USER",
      "createdAt": "2026-06-05T10:00:00.000Z"
    }
  ]
  ```

#### `POST /api/admin/impersonate`
Gera token de impersonação para atendimento/suporte de contas de clientes.
- **Request Body:**
  ```json
  {
    "targetUserId": "7f8a9b..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiImpersonatedJWT...",
    "user": {
      "id": "7f8a9b...",
      "email": "dev@test.com",
      "name": "Developer Test (Suporte)",
      "role": "USER"
    }
  }
  ```

---

### ⚙️ Módulo de Contas Meta (`/api/accounts`)

#### `POST /api/accounts/verify`
Valida credenciais Meta testando consulta de templates com `limit=1` na Graph API.
- **Request Body:**
  ```json
  {
    "wabaId": "123456789012345",
    "phoneNumberId": "123456789012345",
    "accessToken": "EAA..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Conexão validada com sucesso!"
  }
  ```

#### `POST /api/accounts/facebook-onboard/exchange`
Troca o token curto de login do Facebook por um token de longa duração e retorna WABAs e Telefones.
- **Request Body:**
  ```json
  {
    "shortLivedToken": "EAAC..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "longLivedToken": "EAACLongLivedToken...",
    "wabas": [
      {
        "id": "123456789012345",
        "name": "WABA Comercial Inteligentte",
        "phoneNumbers": [
          {
            "id": "1126239797248013",
            "displayPhoneNumber": "+55 83 98624-1167",
            "verifiedName": "Inteligentte Lab"
          }
        ]
      }
    ]
  }
  ```

---

### 👥 Módulo de Contatos & Disparos em Lote

#### `POST /api/accounts/:accountId/lists/:listId/send`
Dispara em lote de background com mapeamento das colunas do CSV para variáveis.
- **Request Body:**
  ```json
  {
    "templateName": "boas_vindas",
    "language": "pt_BR",
    "mappings": [
      { "paramIndex": 1, "csvHeader": "nome" },
      { "paramIndex": 2, "csvHeader": "id_pedido" }
    ]
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "message": "Disparo em lote iniciado em background para 150 contatos."
  }
  ```

---

### 📊 Módulo de Métricas (`/api/accounts/:accountId/metrics`)

#### `GET /api/accounts/:accountId/metrics`
Gera contadores agregados e histórico agrupado por fuso horário local.
- **Query Parameters:**
  - `period`: `"today" | "yesterday" | "7days" | "30days" | "custom"`
  - `startDate`: `"2026-06-01"` (obrigatório se `period` for `custom`)
  - `endDate`: `"2026-06-07"` (opcional)
- **Response (200 OK):**
  ```json
  {
    "totals": {
      "sent": 38,
      "delivered": 24,
      "read": 57,
      "failed": 10,
      "total": 129
    },
    "chartData": [
      {
        "date": "2026-06-05",
        "sent": 25,
        "read": 20,
        "failed": 2
      },
      {
        "date": "2026-06-06",
        "sent": 18,
        "read": 12,
        "failed": 3
      }
    ]
  }
  ```

---

## 🚀 5. Mecânicas Técnicas Internas Fundamentais

### ⏳ A. Fuso Horário Local na Agregação de Métricas
Agrupar timestamps UTC diretamente no banco de dados via SQL (`to_char(createdAt, 'YYYY-MM-DD')`) faz com que envios feitos no final do dia (por exemplo, 22h no horário de Brasília / UTC-3) caiam no dia seguinte no banco de dados. 

Para resolver isso, o endpoint `/metrics`:
1. Busca todas as mensagens brutas do intervalo no banco Neon (Prisma retorna objetos JavaScript `Date` convertidos automaticamente para a timezone da máquina servidora).
2. Usa uma função utilitária local `formatDateLocal(date)` que lê os valores locais `.getFullYear()`, `.getMonth() + 1` e `.getDate()` do servidor para gerar a string chave `YYYY-MM-DD`.
3. Inicializa um mapa de datas (`dailyMap`) cobrindo todos os dias do intervalo com contadores em zero.
4. Varre os registros de mensagens incrementando os valores, garantindo que mesmo os dias com zero disparos apareçam representados no gráfico do dashboard, eliminando buracos visuais.

### 🧵 B. Processamento Assíncrono do Disparo em Massa
Para evitar timeouts em requisições de listas grandes, o envio em lote funciona da seguinte maneira:
- A rota recebe o mapeamento e valida a existência do template e da lista.
- Envia imediatamente um status `202 Accepted` de volta para o cliente frontend.
- O loop de envios prossegue de forma assíncrona no Event Loop do Node.js:
  - Varre os contatos da lista.
  - Para cada contato, lê a posição do valor correspondente ao cabeçalho CSV mapeado.
  - Formata o payload de variáveis do WhatsApp Business API:
    ```json
    {
      "messaging_product": "whatsapp",
      "to": "phone_limpo",
      "type": "template",
      "template": {
        "name": "nome_do_template",
        "language": { "code": "pt_BR" },
        "components": [
          {
            "type": "body",
            "parameters": [
              { "type": "text", "text": "Valor Mapeado 1" }
            ]
          }
        ]
      }
    }
    ```
  - Executa a chamada `axios.post` para a Meta e cria um log inicial de `Message` com status `SENT` ou `FAILED` caso a chamada de rede direta falhe.

---

## 📡 6. Novas Especificações de Endpoints

### 📅 Módulo de Agendamentos Futuros (`/api/accounts/:accountId/scheduled`)

#### `GET /api/accounts/:accountId/scheduled`
Lista todas as mensagens agendadas para o futuro com status `PENDING`.
- **Response (200 OK):**
  ```json
  [
    {
      "id": "abc-123-def",
      "to": "5583986241167",
      "status": "PENDING",
      "templateName": "ofertas_junho",
      "scheduledAt": "2026-06-12T15:00:00.000Z",
      "createdAt": "2026-06-07T12:00:00.000Z"
    }
  ]
  ```

#### `DELETE /api/accounts/:accountId/scheduled/:messageId`
Cancela um agendamento futuro excluindo o registro do banco de dados e enviando uma notificação via SSE com status `CANCELLED`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Agendamento cancelado com sucesso."
  }
  ```

#### `POST /api/accounts/:accountId/scheduled/:messageId/reschedule`
Reagenda um disparo pendente para uma nova data futura, resetando os contadores de retentativa.
- **Request Body:**
  ```json
  {
    "scheduledAt": "2026-06-15T18:30:00.000Z"
  }
  ```
- **Response (200 OK):** Retorna o objeto `Message` com o novo timestamp atualizado.

---

### 👥 Módulo de Edição de Listas de Contatos (`/api/accounts/:accountId/lists/:listId`)

#### `PUT /api/accounts/:accountId/lists/:listId`
Atualiza o nome da lista e sincroniza a relação de contatos (adiciona novos, atualiza existentes e remove ausentes) em lote.
- **Request Body:**
  ```json
  {
    "name": "Clientes VIP Nordeste",
    "contacts": [
      {
        "id": "contato-id-existente-1",
        "name": "Pedro Teste Modificado",
        "phone": "5583986241167",
        "variables": ["VIP", "Desconto 30%"]
      },
      {
        "name": "Contato Novo Inserido",
        "phone": "5511999999999",
        "variables": ["Standard"]
      }
    ]
  }
  ```
- **Response (200 OK):** Retorna a lista atualizada com a nova contagem total de contatos.
