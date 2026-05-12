import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isImage } from "../utils/files";

const execFileAsync = promisify(execFile);

async function runTesseract(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync("tesseract", [filePath, "stdout"]);
  return stdout.trim();
}

export class OCRService {
  async extractText(filePath: string): Promise<string> {
    if (isImage(filePath)) {
      return runTesseract(filePath);
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "rag-ocr-"));
    try {
      const outputPattern = path.join(tempDir, "page-%03d.png");
      await execFileAsync("gs", [
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=png16m",
        "-r200",
        `-sOutputFile=${outputPattern}`,
        filePath
      ]);

      const files = (await readdir(tempDir))
        .filter((entry) => entry.endsWith(".png"))
        .sort((left, right) => left.localeCompare(right));

      const pages: string[] = [];
      for (const file of files) {
        const pageText = await runTesseract(path.join(tempDir, file));
        if (pageText) {
          pages.push(pageText);
        }
      }

      return pages.join("\n\n").trim();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
