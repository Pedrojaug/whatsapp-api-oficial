import axios from "axios";
import { prisma } from "../db";
import { metaService } from "../services/metaService";
import { storageService } from "../services/storageService";

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

    const asset = await prisma.mediaAsset.findFirst({
      where: { url: mediaUrl, accountId },
      select: { filename: true, mimeType: true, fileData: true, url: true }
    });

    if (asset) {
      filename = asset.filename;
      mimeType = asset.mimeType;

      // 1. Tenta obter o buffer via StorageService (Cloudflare R2 ou disco local)
      const storageBuffer = await storageService.getFileBuffer(asset.filename, asset.url);
      if (storageBuffer) {
        buffer = storageBuffer;
      } else if (asset.fileData) {
        // Fallback de compatibilidade para arquivos legados salvos em Base64
        const b64 = asset.fileData.replace(/^data:.*?;base64,/, "");
        buffer = Buffer.from(b64, "base64");
      } else {
        // Fallback via download HTTP
        const resp = await axios.get(asset.url, { responseType: "arraybuffer", timeout: 20000 });
        buffer = Buffer.from(resp.data as any);
      }
    } else {
      // URL externa não gerenciada pelo sistema: baixamos nós mesmos.
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
