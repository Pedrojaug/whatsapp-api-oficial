import axios from "axios";
import { prisma } from "../db";
import { metaService } from "../services/metaService";

/**
 * Sobe uma mídia para o endpoint /media da Meta e retorna o media id, para
 * enviar templates com cabeçalho de mídia por `id` (a Meta hospeda) em vez de
 * `link`. Isso elimina o erro 131053 ("Media upload error"), que acontece
 * quando a Meta não consegue baixar a mídia da nossa URL efêmera no Render.
 *
 * Retorna null em QUALQUER falha — o chamador então usa o link como fallback,
 * garantindo que o comportamento nunca fique pior do que antes.
 */
export async function resolveMetaMediaId(
  phoneNumberId: string,
  accessToken: string,
  mediaUrl: string,
  accountId: string,
): Promise<string | null> {
  try {
    let buffer: Buffer;
    let mimeType: string;
    let filename: string;

    // Preferimos os bytes do banco (fileData Base64) — mais confiável que o
    // disco efêmero do Render.
    const asset = await prisma.mediaAsset.findFirst({ where: { url: mediaUrl, accountId } });
    if (asset && asset.fileData) {
      const b64 = asset.fileData.replace(/^data:.*?;base64,/, "");
      buffer = Buffer.from(b64, "base64");
      mimeType = asset.mimeType;
      filename = asset.filename;
    } else {
      // URL externa (ou asset sem fileData): baixamos nós mesmos.
      const resp = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
        maxContentLength: Infinity,
      });
      buffer = Buffer.from(resp.data as any);
      mimeType = (resp.headers["content-type"] as string) || "application/octet-stream";
      filename = mediaUrl.split("/").pop()?.split("?")[0] || "media";
    }

    return await metaService.uploadMediaBuffer(phoneNumberId, accessToken, buffer, mimeType, filename);
  } catch (err: any) {
    console.error(`[MediaUpload] Falha ao subir mídia para a Meta (${mediaUrl}):`, err?.response?.data || err?.message);
    return null;
  }
}
