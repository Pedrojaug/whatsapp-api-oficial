# Guia de Deploy e Hospedagem em Produção

Este guia descreve as etapas para realizar o deploy em produção da plataforma **Send Inteligentte**.

---

## 🌐 Opção 1: Deploy na Locaweb (Subdomínios da Empresa)

Esta é a estratégia recomendada para hospedar a aplicação em ambiente de produção mantendo a identidade da empresa sob subdomínios próprios (ex: `painel.empresa.com.br` e `api.empresa.com.br`).

### 1. Configurações Prévias de DNS
O administrador do domínio principal da empresa precisará adicionar os seguintes apontamentos na zona de DNS:
- **Frontend (Painel):** Criar uma entrada CNAME ou A para `painel.empresa.com.br` apontando para o servidor web do frontend.
- **Backend (API):** Criar uma entrada A para `api.empresa.com.br` apontando para o IP público da VPS (Virtual Private Server) do backend.

---

### 2. Deploy do Backend (VPS Linux Ubuntu na Locaweb)

Para garantir o funcionamento ininterrupto da fila de disparos (Worker) e dos eventos em tempo real (SSE), o backend deve rodar em uma VPS dedicada usando **PM2** e **Nginx**.

1. **Acessar a VPS via SSH e Instalar Dependências:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y nodejs npm git nginx
   sudo npm install -g pm2
   ```
2. **Clonar o Repositório e Configurar:**
   ```bash
   git clone https://github.com/Pedrojaug/whatsapp-api-oficial.git
   cd whatsapp-api-oficial/backend
   npm install
   ```
3. **Variáveis de Ambiente:**
   Crie o arquivo `.env` na pasta `/backend` contendo:
   ```env
   DATABASE_URL="postgresql://usuario:senha@host:porta/banco?sslmode=require"
   JWT_SECRET="sua-chave-secreta-jwt"
   FACEBOOK_APP_SECRET="segredo-do-app-meta"
   WEBHOOK_VERIFY_TOKEN="sua-senha-de-verificacao-do-webhook"
   FRONTEND_URL="https://painel.empresa.com.br"
   PORT=3001
   ```
4. **Gerar builds e Migrar Banco:**
   ```bash
   npx prisma generate
   npm run build
   ```
5. **Iniciar a API com PM2:**
   ```bash
   pm2 start dist/server.js --name "whatsapp-api"
   pm2 startup
   pm2 save
   ```
6. **Configurar Proxy Reverso com SSL (Nginx):**
   Mapear o subdomínio `api.empresa.com.br` para encaminhar as requisições para a porta interna `3001` e gerar o certificado SSL gratuito via Let's Encrypt / Certbot.

---

### 3. Deploy do Frontend (Hospedagem Estática)

O frontend é composto exclusivamente por arquivos estáticos e de alta performance. Ele pode ser colocado em qualquer hospedagem web simples da Locaweb.

1. **Na sua máquina local, compile o projeto:**
   Acesse a pasta `/frontend` no terminal e execute:
   ```bash
   npm run build
   ```
   *Nota: O build lerá automaticamente as variáveis de `frontend/.env.production` e apontará as chamadas de API para `https://api.empresa.com.br/api`.*
2. **Subir os Arquivos:**
   - Acesse o diretório `/frontend/dist` gerado localmente.
   - Envie todos os arquivos e pastas contidos nele para a pasta pública do subdomínio `painel.empresa.com.br` no gerenciador de arquivos ou FTP da Locaweb.
3. **Instalar SSL:**
   - No painel da Locaweb, certifique-se de ativar o certificado SSL (HTTPS) gratuito para o subdomínio `painel.empresa.com.br`.

---

## 🚀 Opção 2: Deploy na Nuvem (Render.com + Vercel/Netlify)

Caso queiram uma alternativa de deploy ágil em plataformas de PaaS modernas integradas ao GitHub:

1. **Backend no Render.com:**
   - Crie um **Web Service** conectado ao seu repositório do GitHub.
   - Configure a pasta raiz como `backend`.
   - Command Build: `npm install && npm run build`.
   - Command Start: `npm start`.
   - Configure as variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`, etc.) nas configurações.
2. **Frontend na Vercel/Netlify:**
   - Conecte o repositório do GitHub, aponte a pasta raiz como `frontend`.
   - Defina a variável `VITE_API_BASE_URL` nas configurações do painel.
   - A plataforma publicará e gerará o HTTPS automático.
