# Guia de Deploy e Hospedagem em Produção

Este guia descreve as etapas para realizar o deploy em produção da plataforma **Send Inteligentte** usando serviços modernos e **100% gratuitos** (Render + Vercel + Neon DB) vinculados aos subdomínios da empresa (`inteligentte.com.br`).

---

## ☁️ Opção 1: Deploy Gratuito na Nuvem (Render + Vercel) - RECOMENDADO

Esta é a estratégia mais ágil e segura para colocar a aplicação em produção sem custos de infraestrutura e com deploy automático a partir do GitHub.

### 🗺️ Fluxo de Funcionamento e Apelidos (CNAME)
O frontend (Vercel) e o backend (Render) terão domínios próprios autogerados. Usaremos a tabela de DNS da Locaweb para criar "apelidos" (registros `CNAME`), permitindo que a aplicação responda nos subdomínios da empresa.

---

### 1. Deploy do Backend (API e Fila) no Render.com (Grátis)
1. Crie uma conta gratuita em [Render.com](https://render.com/) (você pode se cadastrar usando a conta do GitHub para facilitar).
2. No painel da Render, clique no botão azul **New +** e selecione a opção **Web Service**.
3. Conecte o seu repositório do GitHub `whatsapp-api-oficial` (que já subimos anteriormente).
4. Configure as seguintes propriedades do Web Service:
   - **Name:** `inteligentte-api` (ou similar)
   - **Language:** `Node`
   - **Root Directory:** `backend` 👈 *(MUITO IMPORTANTE: Indica que a pasta do backend está isolada)*
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. **Configurar as Variáveis de Ambiente:**
   Vá até a aba **Environment** e clique em **Add Environment Variable** para cadastrar:
   - `DATABASE_URL`: `postgresql://<usuario>:<senha>@<host>.neon.tech/<banco>?sslmode=require&channel_binding=require`
   - `JWT_SECRET`: Insira uma chave de segurança aleatória (ex: uma frase longa e segura).
   - `FACEBOOK_APP_SECRET`: Segredo do App da Meta.
   - `WEBHOOK_VERIFY_TOKEN`: Token de validação do webhook.
   - `FRONTEND_URL`: `https://painel.inteligentte.com.br`
6. Clique em **Create Web Service**. O deploy iniciará. Em alguns minutos, a Render fornecerá uma URL pública permanente (ex: `https://inteligentte-api.onrender.com`).

---

### 2. Deploy do Frontend (Painel) na Vercel.com (Grátis)
1. Crie uma conta gratuita em [Vercel.com](https://vercel.com/) vinculada ao seu GitHub.
2. Clique em **Add New...** ➡️ **Project** e importe o repositório `whatsapp-api-oficial`.
3. Configure as propriedades do projeto:
   - **Framework Preset:** `Vite` (reconhecido automaticamente)
   - **Root Directory:** `frontend` 👈 *(MUITO IMPORTANTE: Indica a pasta do frontend)*
4. **Adicionar Variáveis de Ambiente:**
   Expanda a seção de variáveis e configure:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://api.inteligentte.com.br/api`
5. Clique em **Deploy**. A Vercel gerará o build e fornecerá uma URL (ex: `https://whatsapp-api-frontend.vercel.app`).

---

### 3. Configurar os Subdomínios (DNS da Locaweb)
Com as duas URLs geradas, acesse a tela de **Entradas de DNS** da Locaweb e clique em **Adicionar Entrada**:

#### Entrada 1 (Painel):
- **Tipo de Entrada:** `CNAME`
- **Nome / Host / Alias:** `painel`
- **Conteúdo / Valor:** A URL gerada pela Vercel (ex: `whatsapp-api-frontend.vercel.app`).
*Nota: Acesse o painel da Vercel em **Settings ➡️ Domains**, adicione o domínio `painel.inteligentte.com.br` para que ela passe a aceitá-lo e gere o certificado SSL automaticamente.*

#### Entrada 2 (API/Backend):
- **Tipo de Entrada:** `CNAME`
- **Nome / Host / Alias:** `api`
- **Conteúdo / Valor:** A URL gerada pela Render (ex: `inteligentte-api.onrender.com`).
*Nota: No painel da Render, vá em **Settings ➡️ Custom Domains** e adicione `api.inteligentte.com.br` para ativar o HTTPS automático.*

---

## 🌐 Opção 2: Deploy na Locaweb (VPS Dedicada e Hospedagem Estática)

Esta opção é indicada apenas se no futuro a empresa preferir hospedar tudo em servidores próprios da Locaweb. As instruções detalhadas para configurar uma VPS Ubuntu do zero estão arquivadas no repositório Git.
