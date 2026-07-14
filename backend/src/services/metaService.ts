import axios from "axios";

/**
 * Serviço centralizado de integração com a API Graph da Meta.
 */
export const metaService = {
  /**
   * Envia uma mensagem (texto, template, etc.) via WhatsApp Business API
   */
  async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
    return axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  },

  /**
   * Sobe um arquivo binário para /{phoneNumberId}/media e retorna o media id.
   * Monta o corpo multipart manualmente (sem dependência de form-data).
   */
  async uploadMediaBuffer(phoneNumberId: string, accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<string> {
    const boundary = "----SendInteligentte" + Date.now().toString(16);
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="type"\r\n\r\n${mimeType}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, file, tail]);
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/media`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return String(res.data.id);
  },

  /**
   * Lista templates cadastrados na WABA
   */
  async fetchTemplates(wabaId: string, accessToken: string, limit?: number) {
    const limitParam = limit ? `?limit=${limit}` : "";
    return axios.get(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates${limitParam}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  },

  /**
   * Cria um novo template na WABA
   */
  async createTemplate(wabaId: string, accessToken: string, payload: any) {
    return axios.post(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
      payload,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  },

  /**
   * Deleta um template na WABA
   */
  async deleteTemplate(wabaId: string, accessToken: string, templateName: string) {
    return axios.delete(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { name: templateName }
      }
    );
  },

  /**
   * Obtém detalhes de uma mídia (como a URL temporária para download)
   */
  async getMediaUrl(mediaId: string, accessToken: string) {
    return axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  /**
   * Obtém o stream binário de um arquivo de mídia Meta
   */
  async getMediaContentStream(mediaUrl: string, accessToken: string) {
    return axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "stream"
    });
  },

  /**
   * Descobre o App ID dono de um token de acesso.
   * O nó especial /app retorna o aplicativo ao qual o token pertence,
   * permitindo suportar múltiplos apps da Meta sem depender de env vars.
   */
  async getAppIdFromToken(accessToken: string): Promise<string> {
    const response = await axios.get(`https://graph.facebook.com/v19.0/app`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return String(response.data.id);
  },

  /**
   * Inicia uma sessão de upload resumível na Meta (Resumable Uploads)
   */
  async initiateResumableUpload(appId: string, accessToken: string, params: { filename: string; file_size: number; file_type: string }) {
    return axios.post(
      `https://graph.facebook.com/v19.0/${appId}/uploads`,
      null,
      {
        params: {
          access_token: accessToken,
          file_name: params.filename,
          file_length: params.file_size,
          file_type: params.file_type
        }
      }
    );
  },

  /**
   * Faz o upload de um chunk binário para a sessão resumível
   */
  async uploadBinaryChunk(uploadSessionId: string, accessToken: string, startByte: number, binaryData: Buffer, mimeType: string) {
    return axios.post(
      `https://graph.facebook.com/v19.0/${uploadSessionId}`,
      binaryData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "file_offset": String(startByte),
          "Content-Type": mimeType
        }
      }
    );
  },

  /**
   * Troca o code temporário do OAuth pelo token de acesso curto
   */
  async exchangeOAuthToken(code: string, clientId: string, clientSecret: string, redirectUri: string) {
    return axios.get(`https://graph.facebook.com/v21.0/oauth/access_token`, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      }
    });
  },

  /**
   * Troca o token de acesso curto por um token permanente/longo (LLT)
   */
  async exchangeLongLivedToken(shortToken: string, clientId: string, clientSecret: string) {
    return axios.get(`https://graph.facebook.com/v21.0/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortToken
      }
    });
  },

  /**
   * Obtém detalhes da conta comercial (WABA)
   */
  async getWabaInfo(wabaId: string, accessToken: string) {
    return axios.get(`https://graph.facebook.com/v21.0/${wabaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  /**
   * Obtém detalhes do número de telefone (Phone Number ID)
   */
  async getPhoneInfo(phoneNumberId: string, accessToken: string) {
    return axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }
};
