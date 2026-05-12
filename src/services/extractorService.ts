import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import mime from "mime-types";
import { OCRService } from "./ocrService";
import { isTextLikeDocument } from "../utils/files";

const textract: any = require("textract");

export interface ExtractedDocument {
  text: string;
  title: string;
  mimeType: string;
  fileType: string;
  usedOcr: boolean;
}

function textractFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error: Error | null, text: string) => {
      if (error) {
        reject(error);
        return;
      }

      resolve((text ?? "").trim());
    });
  });
}

export class ExtractorService {
  constructor(private readonly ocrService = new OCRService()) {}

  async extract(filePath: string): Promise<ExtractedDocument> {
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    const title = path.basename(filePath);

    if (extension === ".txt" || extension === ".md" || isTextLikeDocument(filePath)) {
      const text = (await readFile(filePath, "utf8")).trim();
      return { text, title, mimeType: String(mimeType), fileType: extension.slice(1) || title.toLowerCase(), usedOcr: false };
    }

    if (extension === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        text: result.value.trim(),
        title,
        mimeType,
        fileType: extension.slice(1),
        usedOcr: false
      };
    }

    if (extension === ".odt") {
      const text = await textractFile(filePath);
      return {
        text,
        title,
        mimeType,
        fileType: extension.slice(1),
        usedOcr: false
      };
    }

    if (extension === ".pdf") {
      const buffer = await readFile(filePath);
      const parsed = await pdfParse(buffer);
      const rawText = (parsed.text ?? "").trim();
      if (rawText.length >= 40) {
        return {
          text: rawText,
          title: parsed.info?.Title || title,
          mimeType,
          fileType: "pdf",
          usedOcr: false
        };
      }

      const ocrText = await this.ocrService.extractText(filePath);
      return {
        text: ocrText,
        title: parsed.info?.Title || title,
        mimeType,
        fileType: "pdf",
        usedOcr: true
      };
    }

    const ocrText = await this.ocrService.extractText(filePath);
    return {
      text: ocrText,
      title,
      mimeType,
      fileType: extension.slice(1) || "binary",
      usedOcr: true
    };
  }
}
