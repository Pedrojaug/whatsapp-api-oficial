import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

// Obtém a chave de 32 bytes (garantida via hash sha256)
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY || "chave-secreta-padrao-send-inteligentte-dev";
  return crypto.createHash("sha256").update(key).digest();
};

/**
 * Criptografa uma string usando AES-256-CBC
 */
export function encryptToken(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Descriptografa uma string usando AES-256-CBC.
 * Se a string não estiver no formato criptografado, retorna o texto puro (compatibilidade reversa).
 */
export function decryptToken(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(":")) {
      return encryptedText;
    }

    const [ivHex, encryptedHex] = encryptedText.split(":");
    if (!ivHex || !encryptedHex) {
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Falha ao descriptografar token, retornando valor bruto:", error);
    return encryptedText;
  }
}
