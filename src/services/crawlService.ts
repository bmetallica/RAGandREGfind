import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";
import mime from "mime-types";
import { env } from "../config/env";
import { IngestionService } from "./ingestionService";
import { isDownloadableDocument } from "../utils/files";

interface CrawlOptions {
  startUrl: string;
  maxDepth?: number;
  knowledgeBaseId?: number | null;
}

interface QueueEntry {
  url: string;
  depth: number;
}

function resolveFinalResponseUrl(response: { request?: { res?: { responseUrl?: string }; responseURL?: string } }, fallbackUrl: string): string {
  const responseUrl = response.request?.res?.responseUrl ?? response.request?.responseURL;
  if (!responseUrl) {
    return fallbackUrl;
  }

  try {
    return new URL(responseUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

export class CrawlService {
  constructor(private readonly ingestionService = new IngestionService()) {}

  async crawl(options: CrawlOptions): Promise<{ pages: number; files: number; duplicates: number }> {
    const startUrl = new URL(options.startUrl);
    const maxDepth = options.maxDepth ?? env.CRAWL_DEFAULT_MAX_DEPTH;
    const allowedOrigins = new Set<string>([startUrl.origin]);
    const visited = new Set<string>();
    const queue: QueueEntry[] = [{ url: startUrl.toString(), depth: 0 }];
    let pages = 0;
    let files = 0;
    let duplicates = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.url)) {
        continue;
      }

      visited.add(current.url);
      const response = await axios.get<ArrayBuffer>(current.url, {
        responseType: "arraybuffer",
        timeout: 30_000,
        validateStatus: (status) => status >= 200 && status < 400
      });
      const finalUrl = resolveFinalResponseUrl(response, current.url);
      const finalLocation = new URL(finalUrl);
      allowedOrigins.add(finalLocation.origin);
      visited.add(finalUrl);

      const contentType = response.headers["content-type"] ?? mime.lookup(finalUrl) ?? "application/octet-stream";
      if (!String(contentType).includes("text/html") && isDownloadableDocument(finalUrl)) {
        const result = await this.ingestRemoteFile(finalUrl, Buffer.from(response.data), options.knowledgeBaseId ?? null);
        files += 1;
        if (result.duplicate) {
          duplicates += 1;
        }
        continue;
      }

      const html = Buffer.from(response.data).toString("utf8");
      const $ = cheerio.load(html);
      $("script, style, noscript").remove();
      const title = $("title").first().text().trim() || finalUrl;
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();

      if (bodyText) {
        const result = await this.ingestionService.ingestText({
          sourceType: "crawl",
          sourceRef: finalUrl,
          knowledgeBaseId: options.knowledgeBaseId ?? null,
          sourceUrl: finalUrl,
          title,
          text: bodyText,
          mimeType: String(contentType),
          fileType: "html",
          metadata: {
            crawlDepth: current.depth,
            redirectSourceUrl: finalUrl !== current.url ? current.url : undefined
          }
        });

        pages += 1;
        if (result.duplicate) {
          duplicates += 1;
        }
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      const links = $("a[href]")
        .map((_, element) => $(element).attr("href"))
        .get()
        .filter(Boolean) as string[];

      for (const href of links) {
        const resolved = new URL(href, finalUrl);
        if (!allowedOrigins.has(resolved.origin)) {
          continue;
        }

        if (isDownloadableDocument(resolved.toString())) {
          const fileResponse = await axios.get<ArrayBuffer>(resolved.toString(), {
            responseType: "arraybuffer",
            timeout: 30_000,
            validateStatus: (status) => status >= 200 && status < 400
          });
          const result = await this.ingestRemoteFile(resolved.toString(), Buffer.from(fileResponse.data), options.knowledgeBaseId ?? null);
          files += 1;
          if (result.duplicate) {
            duplicates += 1;
          }
          continue;
        }

        if (!visited.has(resolved.toString())) {
          queue.push({ url: resolved.toString(), depth: current.depth + 1 });
        }
      }
    }

    return { pages, files, duplicates };
  }

  private async ingestRemoteFile(url: string, buffer: Buffer, knowledgeBaseId?: number | null) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "rag-crawl-"));
    try {
      const pathname = new URL(url).pathname;
      const baseName = path.basename(pathname) || "downloaded-file";
      const filePath = path.join(tempDir, baseName);
      await writeFile(filePath, buffer);
      return this.ingestionService.ingestFile({
        filePath,
        sourceType: "crawl-file",
        sourceRef: url,
        knowledgeBaseId: knowledgeBaseId ?? null,
        sourceUrl: url,
        metadata: {
          downloadedFrom: url
        }
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
