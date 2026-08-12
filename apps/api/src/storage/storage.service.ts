import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/**
 * Local-disk file storage. The interface is intentionally narrow (save
 * buffer -> relative path, read path -> buffer) so swapping to an
 * S3/Supabase Storage-compatible driver in production is a single-class
 * change, per the PRD's recommended object storage architecture.
 */
@Injectable()
export class StorageService {
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = path.resolve(
      process.cwd(),
      this.configService.get<string>("STORAGE_LOCAL_PATH") ?? "./storage",
    );
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  async save(subdir: string, originalName: string, buffer: Buffer): Promise<string> {
    const dir = path.join(this.basePath, subdir);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const fullPath = path.join(dir, safeName);
    await fs.promises.writeFile(fullPath, buffer);
    return path.join(subdir, safeName);
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.promises.readFile(path.join(this.basePath, relativePath));
  }
}
