import { readdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { IngestionService } from "./ingestionService";
import { isSupportedDocument } from "../utils/files";

async function walk(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
}

export class DirectorySyncService {
  constructor(private readonly ingestionService = new IngestionService()) {}

  async sync(rootDir = env.IMPORT_DIR, knowledgeBaseId?: number | null): Promise<{ scanned: number; imported: number; duplicates: number }> {
    const files = await walk(rootDir);
    let imported = 0;
    let duplicates = 0;

    for (const filePath of files.filter(isSupportedDocument)) {
      const result = await this.ingestionService.ingestFile({
        filePath,
        sourceType: "directory",
        sourceRef: path.relative(rootDir, filePath),
        knowledgeBaseId: knowledgeBaseId ?? null,
        metadata: {
          rootDir
        }
      });

      if (result.duplicate) {
        duplicates += 1;
      } else {
        imported += 1;
      }
    }

    return {
      scanned: files.length,
      imported,
      duplicates
    };
  }
}
