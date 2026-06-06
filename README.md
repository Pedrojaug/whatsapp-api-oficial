# Send Inteligentte 🚀

Plataforma premium de automação e disparo em lote utilizando a **API Oficial do WhatsApp (Meta Graph API)**. O sistema conta com controle de acesso multi-inquilino (multi-tenant), gerenciador visual de templates, importador dinâmico de contatos CSV e um painel de métricas analítico com histórico de envios e funil de conversão.

---

## 🎨 Principais Funcionalidades

- **🔒 Login & Multi-Tenant:** Isolamento total de dados entre contas de clientes. Credenciais criptografadas de forma segura e sessões mantidas por tokens JWT.
- **🛠️ Modo Suporte (Impersonação):** Usuários administradores (`SUPERUSER`) podem entrar na conta de qualquer cliente para prestar suporte e configurar o canal diretamente, com aviso visual dinâmico.
- **⚡ Wizard de Pareamento Meta:** Assistente de conexão automatizado via pop-up OAuth do Facebook Login ou configuração manual passo a passo das chaves da Meta.
- **📝 Construtor de Templates:** Construtor visual de templates de mensagens (suportando cabeçalhos dinâmicos com upload de imagens/vídeos, variáveis no corpo, rodapés e botões de chamada para ação) com simulador de WhatsApp em tempo real.
- **👥 Listas de Contatos e Envio em Massa:** Importador de listas CSV com detecção automática de colunas. Mapeamento arrasta-e-solta das colunas do CSV para preencher variáveis dinâmicas de templates, processado de forma assíncrona em background.
- **📊 Painel de Métricas e Gráficos:** Relatórios interativos por período preset ou personalizado, contadores em tempo real, cálculo de funil (Taxas de Abertura e Entrega) e gráfico de barras empilhadas mostrando a relação de Enviados, Lidos e Falhas.

---

## ⚙️ Pré-requisitos e Ambiente

Antes de iniciar as aplicações, certifique-se de possuir:
- **Node.js** (versão 18 ou superior)
- **npm** (ou yarn/pnpm)
- Instância ativa de banco de dados **PostgreSQL** (ex: Neon Database)

---

## 🚀 Como Iniciar o Projeto

### 🔌 1. Configurando o Backend
1. Navegue até a pasta do servidor:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` baseado no modelo de ambiente e insira as credenciais do banco e chaves da Meta:
   ```env
   DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require"
   JWT_SECRET="sua-chave-secreta-do-jwt"
   PORT=3001
   FACEBOOK_APP_ID="seu-app-id-meta"
   FACEBOOK_APP_SECRET="seu-app-secret-meta"
   WEBHOOK_VERIFY_TOKEN="sua-senha-do-webhook"
   ```
4. Execute as migrações do banco de dados (Prisma):
   ```bash
   npx prisma db push
   ```
5. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

*(Opcional) Para povoar o painel com dados mockados de disparos dos últimos 15 dias para testes visuais, execute:*
```bash
node seed_metrics.js
```

---

## 💻 2. Configurando o Frontend
1. Navegue até a pasta da interface:
   ```bash
   cd ../frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` na raiz da pasta `frontend`:
   ```env
   VITE_API_BASE_URL="http://localhost:3001/api"
   VITE_FACEBOOK_APP_ID="seu-app-id-meta"
   ```
4. Inicie o servidor Vite de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse o painel pelo navegador em: `http://localhost:5173/`

---

## 🔑 Credenciais Locais de Teste

Se o banco foi populado com o script `seed_metrics.js`, utilize as seguintes contas para testar:

*   **Painel Administrador / Suporte (`SUPERUSER`):**
    *   **E-mail:** `pedro@teste.com`
    *   **Senha:** `password123`
*   **Painel Cliente Comum (`USER`):**
    *   **E-mail:** `cliente@teste.com`
    *   **Senha:** `password123`

---

## 📡 Integração de Webhooks em Desenvolvimento (Ngrok)

Para receber as atualizações de status de entrega de mensagens da Meta API localmente, utilize uma ferramenta de encaminhamento (ex: Ngrok):

1. Com o backend rodando na porta `3001`, inicie o Ngrok:
   ```bash
   ngrok http 3001
   ```
2. Copie a URL gerada HTTPS (ex: `https://abcd-123.ngrok-free.app`).
3. Configure nas definições de webhook do seu aplicativo do Facebook Developers:
   - **URL de Retorno:** `https://abcd-123.ngrok-free.app/webhooks`
   - **Token de Verificação:** O mesmo valor definido no `WEBHOOK_VERIFY_TOKEN` do seu backend.
   - **Campos de Inscrição:** Ative a escuta para o evento `messages`.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, Neon PostgreSQL, bcryptjs, jsonwebtoken.
- **Frontend:** React, Vite, TypeScript, Axios, Vanilla CSS (Design em Glassmorphism e animações).
- **Integração:** Meta Graph API (v19.0) e Webhooks.
