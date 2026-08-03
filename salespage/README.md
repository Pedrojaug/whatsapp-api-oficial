# Send Inteligente Comercial

Pagina comercial em Next.js para venda do Send Inteligente, com checkout visual preparado para integracao com Asaas, area administrativa protegida por login e editor de conteudo da pagina inicial.

## Visao geral

O Send Inteligente e uma interface comercial para apresentar planos de disparos via API Oficial da Meta, coletar dados do comprador e conduzir o usuario ate o fluxo de boas-vindas.

Rotas principais:

- `/` - pagina de vendas e escolha de plano.
- `/checkout` - formulario de dados, escolha de plano e forma de pagamento.
- `/boas-vindas` - tela exibida apos confirmacao do checkout.
- `/admin` - painel administrativo protegido por login.
- `/admin/conteudo` - editor dos textos da pagina inicial.

## Stack

- Next.js 16 com App Router
- React 19
- TypeScript
- CSS global sem framework externo de UI

## Requisitos

- Node.js 20.9 ou superior
- npm

## Como rodar localmente

Instale as dependencias:

```bash
npm install
```

Crie o arquivo de ambiente local a partir do exemplo:

```bash
cp .env.example .env.local
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Preencha o `.env.local` com seus valores reais e inicie o servidor:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

## Variaveis de ambiente

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=troque-esta-senha
ADMIN_SESSION_SECRET=troque-este-segredo-longo

ASAAS_ENV=sandbox
ASAAS_API_KEY=
ASAAS_WEBHOOK_AUTH_TOKEN=
APP_BASE_URL=http://localhost:3000
```

Notas:

- `.env.local` nunca deve ser commitado.
- `ASAAS_API_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` e `ASAAS_WEBHOOK_AUTH_TOKEN` sao segredos de servidor.
- Nao use prefixo `NEXT_PUBLIC_` em chaves, tokens ou senhas.
- Para webhooks do Asaas, `APP_BASE_URL` precisa ser uma URL publica em ambiente real ou de testes externos.

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

## Status da integracao Asaas

O checkout ja possui a interface para selecionar plano e forma de pagamento. A proxima etapa e substituir o fluxo simulado por endpoints reais:

- `POST /api/checkout` para criar o checkout no Asaas.
- `POST /api/webhooks/asaas` para receber eventos de pagamento.
- Persistencia de pedidos/eventos para garantir idempotencia.

## Cuidados de versionamento

Arquivos e pastas ignorados:

- `.env.local`
- `.env`
- `.env.*`
- `.next/`
- `node_modules/`
- `.vercel/`
- `tsconfig.tsbuildinfo`

Antes de publicar mudancas:

```bash
npm run typecheck
npm run build
npm audit
git status
```
