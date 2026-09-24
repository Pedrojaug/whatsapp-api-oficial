import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

export interface IStorageService {
  isCloudConfigured(): boolean;
  uploadFile(filename: string, buffer: Buffer, mimeType: string, backendFallbackUrl?: string): Promise<string>;
  deleteFile(filename: string): Promise<void>;
  getFileBuffer(filename: string, url?: string): Promise<Buffer | null>;
}

class StorageService implements IStorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private publicUrl: string | null = null;
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    this.initCloudClient();
  }

  private initCloudClient() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    const endpoint = process.env.S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    const pubUrl = process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL;

    if (accessKeyId && secretAccessKey && bucket && endpoint) {
      this.s3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.bucketName = bucket;
      this.publicUrl = pubUrl ? pubUrl.replace(/\/+$/, "") : null;
      console.log(`[StorageService] Provedor de Cloud Storage (Cloudflare R2) configurado com sucesso! Bucket: ${bucket}`);
    } else {
      console.log("[StorageService] R2/S3 não configurado no .env. Operando em modo de armazenamento local (uploads/).");
    }
  }

  public isCloudConfigured(): boolean {
    return Boolean(this.s3Client && this.bucketName && this.publicUrl);
  }

  public async uploadFile(
    filename: string,
    buffer: Buffer,
    mimeType: string,
    backendFallbackUrl?: string
  ): Promise<string> {
    if (this.isCloudConfigured() && this.s3Client && this.bucketName && this.publicUrl) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      return `${this.publicUrl}/${filename}`;
    }

    // Modo local (fallback / ambiente de testes sem R2 configurado)
    const filePath = path.join(this.uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const baseUrl = backendFallbackUrl || process.env.BACKEND_URL || "http://localhost:3001";
    return `${baseUrl.replace(/\/+$/, "")}/uploads/${filename}`;
  }

  public async deleteFile(filename: string): Promise<void> {
    if (this.isCloudConfigured() && this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: filename,
          })
        );
      } catch (err: any) {
        console.warn(`[StorageService] Falha ao deletar arquivo ${filename} do Cloudflare R2:`, err.message);
      }
    }

    // Também limpa do disco local caso exista
    const filePath = path.join(this.uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        console.warn(`[StorageService] Falha ao deletar arquivo local ${filename}:`, err.message);
      }
    }
  }

  public async getFileBuffer(filename: string, url?: string): Promise<Buffer | null> {
    // 1. Tentar ler do disco local
    const filePath = path.join(this.uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }

    // 2. Se estiver no R2, baixar via S3 SDK
    if (this.isCloudConfigured() && this.s3Client && this.bucketName) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: filename,
          })
        );
        if (response.Body) {
          const byteArray = await response.Body.transformToByteArray();
          return Buffer.from(byteArray);
        }
      } catch (err: any) {
        console.warn(`[StorageService] Falha ao ler arquivo ${filename} do R2:`, err.message);
      }
    }

    // 3. Fallback: baixar da URL pública se fornecida
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      try {
        const axios = (await import("axios")).default;
        const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return Buffer.from(res.data);
      } catch (err: any) {
        console.warn(`[StorageService] Falha ao baixar mídia da URL ${url}:`, err.message);
      }
    }

    return null;
  }
}

export const storageService = new StorageService();
