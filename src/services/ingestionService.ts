import path from "node:path";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { ExtractorService } from "./extractorService";
import { VectorService } from "./vectorService";
import { normalizeDocumentText, smartChunkText } from "../utils/chunking";
import { sha256 } from "../utils/hash";
import { inferDocumentType, persistDocumentStructure } from "./documentService";
import { upsertDocumentFile } from "./originalFileService";
import { logger } from "../utils/logger";
import { searchIndexService } from "./searchIndexService";
import { DocumentClassificationService } from "./classificationService";

export interface IngestTextInput {
  sourceType: string;
  sourceRef: string;
  knowledgeBaseId?: number | null;
  sourceUrl?: string;
  title?: string;
  text: string;
  mimeType?: string;
  fileType?: string;
  metadata?: Record<string, unknown>;
  originalFilePath?: string;
  originalFileName?: string;
  originalExternalUrl?: string;
}

export interface IngestFileInput {
  filePath: string;
  sourceType: string;
  sourceRef: string;
  knowledgeBaseId?: number | null;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export class IngestionService {
  constructor(
    private readonly extractorService = new ExtractorService(),
    private readonly vectorService = new VectorService(),
    private readonly classificationService = new DocumentClassificationService()
  ) {}

  async ingestFile(input: IngestFileInput) {
    const extracted = await this.extractorService.extract(input.filePath);
    const uploadedFileName = typeof input.metadata?.uploadedFileName === "string"
      ? input.metadata.uploadedFileName
      : null;
    const sourceRefName = input.sourceType === "crawl-file"
      ? this.getUrlFileName(input.sourceRef)
      : path.basename(input.sourceRef);

    return this.ingestText({
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      knowledgeBaseId: input.knowledgeBaseId ?? null,
      sourceUrl: input.sourceUrl,
      title: extracted.title,
      text: extracted.text,
      mimeType: extracted.mimeType,
      fileType: extracted.fileType,
      originalFilePath: input.filePath,
      originalFileName: uploadedFileName || sourceRefName || path.basename(input.filePath),
      originalExternalUrl: input.sourceUrl,
      metadata: {
        ...(input.metadata ?? {}),
        usedOcr: extracted.usedOcr,
        filePath: input.filePath
      }
    });
  }

  async ingestText(input: IngestTextInput): Promise<{ documentId: number; duplicate: boolean; chunkCount: number }> {
    const normalizedText = normalizeDocumentText(input.text);
    if (!normalizedText) {
      throw new Error(`no text extracted for ${input.sourceRef}`);
    }

    const contentHash = sha256(normalizedText);
    const chunks = smartChunkText(normalizedText, {
      chunkSize: env.CHUNK_SIZE,
      overlap: env.CHUNK_OVERLAP
    });

    if (chunks.length === 0) {
      throw new Error(`chunking produced no output for ${input.sourceRef}`);
    }

    const preflightExisting = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM documents
        WHERE content_hash = $1
          AND COALESCE(knowledge_base_id, 0) = COALESCE($2::bigint, 0)
        LIMIT 1
      `,
      [contentHash, input.knowledgeBaseId ?? null]
    );
    if (preflightExisting.rowCount) {
      return { documentId: preflightExisting.rows[0].id, duplicate: true, chunkCount: 0 };
    }

    const heuristicDocumentType = inferDocumentType({
      title: input.title,
      sourceRef: input.sourceRef,
      sourceType: input.sourceType,
      fileType: input.fileType,
      metadata: input.metadata
    });

    let classificationMetadata: Record<string, unknown> | null = null;
    try {
      const classification = await this.classificationService.classifyDocument({
        title: input.title,
        sourceRef: input.sourceRef,
        sourceType: input.sourceType,
        fileType: input.fileType,
        text: normalizedText,
        fallbackDocumentType: heuristicDocumentType
      });

      classificationMetadata = this.classificationService.buildClassificationMetadata(input.metadata, classification);
    } catch (error) {
      logger.warn({ err: error, sourceRef: input.sourceRef }, "document classification failed; falling back to heuristic document type");
      classificationMetadata = {
        documentType: heuristicDocumentType
      };
    }

    const documentMetadata = {
      ...(classificationMetadata ?? {})
    };

    const client = await pool.connect();
    let committedDocumentId: number | null = null;
    let duplicateDocumentId: number | null = null;
    let committedChunkCount = 0;
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ id: number }>(
        `
          SELECT id
          FROM documents
          WHERE content_hash = $1
            AND COALESCE(knowledge_base_id, 0) = COALESCE($2::bigint, 0)
          LIMIT 1
        `,
        [contentHash, input.knowledgeBaseId ?? null]
      );
      if (existing.rowCount) {
        await client.query("COMMIT");
        duplicateDocumentId = existing.rows[0].id;
        return { documentId: existing.rows[0].id, duplicate: true, chunkCount: 0 };
      }

      const documentInsert = await client.query<{ id: number }>(
        `
          INSERT INTO documents (
            source_type,
            source_ref,
            source_url,
            title,
            knowledge_base_id,
            content_hash,
            mime_type,
            file_type,
            extracted_text,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
          input.sourceType,
          input.sourceRef,
          input.sourceUrl ?? null,
          input.title ?? null,
          input.knowledgeBaseId ?? null,
          contentHash,
          input.mimeType ?? null,
          input.fileType ?? null,
          normalizedText,
          JSON.stringify(documentMetadata)
        ]
      );

      const documentId = documentInsert.rows[0].id;
      committedDocumentId = documentId;
      const embeddings = await this.vectorService.embed(chunks.map((chunk) => chunk.content));
      for (const [index, chunk] of chunks.entries()) {
        await client.query(
          `
            INSERT INTO document_chunks (
              document_id,
              document_section_id,
              chunk_index,
              content,
              token_estimate,
              start_offset,
              end_offset,
              metadata,
              embedding
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
          `,
          [
            documentId,
            null,
            chunk.chunkIndex,
            chunk.content,
            chunk.tokenEstimate,
            chunk.startOffset,
            chunk.endOffset,
            JSON.stringify({
              ...documentMetadata,
              chunkIndex: chunk.chunkIndex,
              startOffset: chunk.startOffset,
              endOffset: chunk.endOffset
            }),
            `[${embeddings[index].join(",")}]`
          ]
        );
      }

      await persistDocumentStructure(client, {
        documentId,
        text: normalizedText
      });

      if (input.originalFilePath || input.originalExternalUrl || input.sourceUrl) {
        await upsertDocumentFile(client, documentId, {
          localPath: input.originalFilePath,
          externalUrl: input.originalExternalUrl ?? input.sourceUrl,
          originalName: input.originalFileName ?? input.title ?? input.sourceRef,
          mimeType: input.mimeType,
          metadata: {
            ...documentMetadata,
            sourceType: input.sourceType,
            sourceRef: input.sourceRef
          }
        });
      }

      await client.query("COMMIT");
      committedChunkCount = chunks.length;
      return { documentId, duplicate: false, chunkCount: chunks.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();

      const documentIdToSync = committedDocumentId ?? duplicateDocumentId;
      if (documentIdToSync && searchIndexService.isEnabled()) {
        void searchIndexService.syncDocument(documentIdToSync).catch((error) => {
          logger.warn({ err: error, documentId: documentIdToSync }, "failed to sync document to elasticsearch after ingestion");
        });
      }
    }
  }

  private getUrlFileName(value: string): string | null {
    try {
      const url = new URL(value);
      const fileName = path.basename(url.pathname);
      return fileName || null;
    } catch {
      return null;
    }
  }
}
