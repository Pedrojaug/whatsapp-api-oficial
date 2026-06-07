# Guia de Integração: n8n + Plataforma de Disparos (Meta API)

Este guia explica como conectar seus fluxos de automação do **n8n** com a sua nova plataforma de disparos oficial para enviar mensagens de forma programática.

---

## 🗺️ Como a Integração Funciona

O seu n8n se comunicará com o backend da sua plataforma através de requisições HTTP REST. 

```
┌─────────────┐       HTTP POST        ┌─────────────┐       Meta API        ┌───────────┐
│     n8n     │ ─────────────────────> │ Nosso Server│ ────────────────────> │ WhatsApp  │
│  Automação  │                        │ (Port 3001) │                       │  Cliente  │
└─────────────┘                        └─────────────┘                       └───────────┘
```

O endpoint principal de disparo é:
```bash
POST http://localhost:3001/api/accounts/{ACCOUNT_ID}/messages/send
```
*(Substitua `{ACCOUNT_ID}` pelo ID da conta cadastrada, visível na aba **Configurações** do seu painel).*

---

## ⚡ Passo 1: Importar o Fluxo Pronto no n8n

Criamos um modelo de fluxo pré-configurado para você carregar no n8n em segundos:

1. Abra o arquivo **n8n_workflow_template.json** que está na raiz do seu projeto.
2. Copie todo o conteúdo JSON do arquivo.
3. No seu n8n, crie um novo workflow vazio.
4. Use o atalho **Ctrl + V** (ou **Cmd + V** no Mac) na tela de edição, ou clique no menu de opções do workflow no canto superior direito e selecione **"Import from JSON"** e cole o código.
5. O n8n gerará automaticamente dois nós conectados:
   - **Webhook Input:** Onde sua automação recebe dados de entrada (ex: de um formulário ou CRM).
   - **Disparar API Oficial:** O nó HTTP configurado para chamar o seu servidor.

---

## 🛠️ Passo 2: Configurando o nó HTTP Request Manualmente

Caso prefira montar do zero no n8n, configure o nó **HTTP Request** com as seguintes propriedades:

* **Method:** `POST`
* **URL:** `http://localhost:3001/api/accounts/SEU_ACCOUNT_ID/messages/send`
* **Send Body:** Marcar como `True`
* **Body Content Type:** `JSON`
* **Specify Body:** `Using JSON (Below)`
* **JSON:**
  ```json
  {
    "to": "5511999999999",
    "templateName": "nome_do_template_aprovado",
    "language": "pt_BR",
    "variables": ["Pedro", "Pedido #1002"]
  }
  ```

### 💡 Como enviar variáveis dinâmicas do n8n:
No campo JSON do nó HTTP Request do n8n, você pode mapear os campos que vieram dos nós anteriores. Exemplo:
```json
{
  "to": "{{ $json.cliente.telefone }}",
  "templateName": "confirmacao_pedido",
  "variables": [
    "{{ $json.cliente.nome }}",
    "{{ $json.pedido.codigo }}"
  ]
}
```

---

## 🔄 Recebendo Status das Mensagens no n8n (Webhooks)

Se você quiser que o n8n reaja quando a mensagem for **lida (READ)** ou se **falhar (FAILED)**, você pode receber esses eventos do nosso servidor:

1. **Crie um nó "Webhook"** no n8n com o método `POST` (ex: gera a URL `https://n8n.seu-sistema.com/webhook/status-whatsapp`).
2. **Adicione suporte a redirecionamento no Backend:** (Se quiser habilitar isso, podemos adicionar uma configuração simples no nosso backend para que, ao receber o webhook da Meta, ele repasse o evento JSON para a URL do n8n do seu cliente).
