import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { normalizeDocumentText } from "../utils/chunking";
import { inferDocumentTypeFromSettings } from "./documentTypeRegistryService";

const DOCUMENT_STRUCTURE_BACKFILL_LOCK = 4_291_001;
const DOCUMENT_STRUCTURE_VERSION = 2;

export interface DocumentRecord {
  id: number;
  title: string | null;
  sourceType: string;
  sourceRef: string;
  sourceUrl: string | null;
  mimeType: string | null;
  fileType: string | null;
  extractedText: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function buildDocumentLocatorTerms(input?: string): string[] {
  if (!input) {
    return [];
  }

  const baseTerms = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  const expandedTerms = new Set<string>();
  for (const term of baseTerms) {
    expandedTerms.add(term);
    if (/(?:e|en|er|es|n|s)$/.test(term) && term.length >= 6) {
      expandedTerms.add(term.replace(/(?:e|en|er|es|n|s)$/u, ""));
    }
  }

  return [...expandedTerms].filter((term) => term.length >= 3);
}

export interface DocumentSection {
  id?: number;
  index: number;
  title: string;
  content: string;
  preview: string;
  startOffset: number;
  endOffset: number;
  matchScore: number;
  sectionType: string;
  metadata: Record<string, unknown>;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface DocumentStructureNode {
  id?: number;
  index: number;
  title: string;
  level: number;
  sectionType: string;
  pageStart: number | null;
  pageEnd: number | null;
  preview: string;
  metadata: Record<string, unknown>;
}

interface DocumentRow {
  id: number;
  title: string | null;
  source_type: string;
  source_ref: string;
  source_url: string | null;
  mime_type: string | null;
  file_type: string | null;
  extracted_text: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface StoredSectionRow {
  id: number;
  section_index: number;
  title: string;
  content: string;
  preview: string;
  start_offset: number;
  end_offset: number;
  section_type: string;
  metadata: Record<string, unknown> | null;
  page_start: number | null;
  page_end: number | null;
}

interface ChunkRow {
  id: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
}

interface ChunkSpan {
  id?: number;
  chunkIndex: number;
  content: string;
  startOffset: number;
  endOffset: number;
  metadata?: Record<string, unknown>;
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function detectPageNumber(line: string): number | null {
  const match = normalizeLine(line).match(/(?:^|\s)(?:seite|page)\s+(\d{1,5})\b/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function classifySectionType(title: string): string {
  const normalized = title.toLowerCase();
  if (/^(kapitel|chapter)\b/.test(normalized)) {
    return "chapter";
  }
  if (/^(teil|part)\b/.test(normalized)) {
    return "part";
  }
  if (/^(abschnitt|section|teil)\b/.test(normalized)) {
    return "section";
  }
  if (/^(top|tagesordnungspunkt|punkt)\s+\d+[a-z]?\b/.test(normalized)) {
    return "agenda_item";
  }
  if (/^(zusammenfassung|summary|ueberblick|überblick)\b/.test(normalized)) {
    return "summary";
  }
  if (/^(anhang|appendix)\b/.test(normalized)) {
    return "appendix";
  }
  return "generic";
}

function isLikelyHeading(line: string): boolean {
  const normalized = normalizeLine(line);
  if (!normalized || normalized.length > 140) {
    return false;
  }

  if (/^(kapitel|chapter|section|abschnitt|teil|anhang|appendix)\b/i.test(normalized)) {
    return true;
  }
  if (/^(part|book)\s+[ivxlcdm\d]+\b/i.test(normalized)) {
    return true;
  }
  if (/^(top|tagesordnungspunkt|punkt)\s+\d+[a-z]?\b/i.test(normalized)) {
    return true;
  }
  if (/^#\s+/.test(normalized)) {
    return true;
  }
  if (/^(\d+|[ivxlcdm]+)(?:[.)]|\s+-)\s+[\p{L}\p{N}]/iu.test(normalized)) {
    return true;
  }
  if (/^\d+(?:[.)]|\.\d+)+(?:\s+|$)/.test(normalized)) {
    return true;
  }
  if (/^(introduction|einleitung|overview|ueberblick|überblick|fazit|conclusion|appendix|anhang)\b/i.test(normalized)) {
    return true;
  }
  if (detectPageNumber(normalized) !== null) {
    return true;
  }

  const lettersOnly = normalized.replace(/[^\p{L}]+/gu, "");
  const uppercaseRatio = lettersOnly.length > 0
    ? normalized.replace(/[^A-ZÄÖÜ]/g, "").length / lettersOnly.length
    : 0;

  if (uppercaseRatio >= 0.7 && normalized.length <= 90) {
    return true;
  }
  if (/:$/.test(normalized) && normalized.length <= 100) {
    return true;
  }
  if (normalized.length <= 90 && /^[\p{L}\p{N}][\p{L}\p{N}\s,&()\-/.]+$/u.test(normalized)) {
    const words = normalized.split(/\s+/);
    const capitalizedWords = words.filter((word) => /^[A-ZÄÖÜ][\p{L}\p{N}-]+$/u.test(word)).length;
    if (words.length >= 2 && capitalizedWords / words.length >= 0.75) {
      return true;
    }
  }

  return false;
}

function fallbackSectionTitle(index: number): string {
  return index === 0 ? "Document Start" : `Section ${index + 1}`;
}

function buildPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 220);
}

function inferSectionLevel(title: string, sectionType: string): number {
  if (sectionType === "chapter" || sectionType === "part") {
    return 1;
  }
  if (sectionType === "agenda_item") {
    return 2;
  }

  const normalized = normalizeLine(title);
  const numbered = normalized.match(/^(\d+(?:\.\d+)*)/);
  if (numbered) {
    return Math.max(1, Math.min(4, numbered[1].split(".").length));
  }
  if (/^#{1,6}\s+/.test(normalized)) {
    const hashCount = normalized.match(/^#+/)?.[0].length ?? 1;
    return Math.max(1, Math.min(6, hashCount));
  }
  return sectionType === "generic" ? 2 : 1;
}

export function inferDocumentType(document: {
  title?: string | null;
  sourceRef?: string | null;
  sourceType?: string | null;
  fileType?: string | null;
  metadata?: Record<string, unknown>;
}): string {
  const metadataType = typeof document.metadata?.documentType === "string" ? document.metadata.documentType : null;
  if (metadataType) {
    return metadataType;
  }

  return inferDocumentTypeFromSettings(document);
}

function buildFallbackSections(text: string): DocumentSection[] {
  const maxSectionLength = 6000;
  const overlap = 400;
  const sections: DocumentSection[] = [];
  let offset = 0;
  let index = 0;

  while (offset < text.length) {
    const endOffset = Math.min(text.length, offset + maxSectionLength);
    const content = text.slice(offset, endOffset).trim();
    if (!content) {
      break;
    }

    sections.push({
      index,
      title: fallbackSectionTitle(index),
      content,
      preview: buildPreview(content),
      startOffset: offset,
      endOffset,
      matchScore: 0,
      sectionType: "generic",
      metadata: {},
      pageStart: null,
      pageEnd: null
    });

    index += 1;
    if (endOffset >= text.length) {
      break;
    }
    offset = Math.max(endOffset - overlap, offset + 1);
  }

  return sections;
}

export function deriveDocumentSections(text: string): DocumentSection[] {
  const normalizedText = normalizeDocumentText(text);
  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split("\n");
  const headingIndices = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    if (isLikelyHeading(lines[index])) {
      headingIndices.add(index);
    }
  }

  if (headingIndices.size === 0) {
    return buildFallbackSections(normalizedText);
  }

  const sections: DocumentSection[] = [];
  let currentTitle = "Document Start";
  let currentLines: string[] = [];
  let currentStartOffset = 0;
  let currentOffset = 0;
  let currentPageNumber: number | null = null;

  const pushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content) {
      return;
    }

    const title = currentTitle || fallbackSectionTitle(sections.length);
    sections.push({
      index: sections.length,
      title,
      content,
      preview: buildPreview(content),
      startOffset: currentStartOffset,
      endOffset: currentStartOffset + content.length,
      matchScore: 0,
      sectionType: classifySectionType(title),
      metadata: {
        heading: title,
        hasTasks: /\b(?:offen|aufgaben?|to do|todo|verantwortlich|frist|deadline)\b/i.test(content),
        hasDecisions: /\b(?:beschluss|beschlossen|entscheidung|genehmigt|freigegeben)\b/i.test(content),
        lineCount: content.split("\n").length,
        structureVersion: DOCUMENT_STRUCTURE_VERSION
      },
      pageStart: currentPageNumber,
      pageEnd: currentPageNumber
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeLine(line);
    const pageNumber = detectPageNumber(normalizedLine);
    if (pageNumber !== null) {
      currentPageNumber = pageNumber;
    }

    const lineWithBreak = index < lines.length - 1 ? `${line}\n` : line;
    if (headingIndices.has(index) && currentLines.length > 0) {
      pushSection();
      currentLines = [];
      currentStartOffset = currentOffset;
      currentTitle = normalizedLine || fallbackSectionTitle(sections.length);
    }

    if (headingIndices.has(index) && currentLines.length === 0) {
      currentTitle = normalizedLine || fallbackSectionTitle(sections.length);
    }

    currentLines.push(line);
    currentOffset += lineWithBreak.length;
  }

  pushSection();
  return sections.length > 0 ? sections : buildFallbackSections(normalizedText);
}

export function rankDocumentSections(sections: DocumentSection[], query?: string): DocumentSection[] {
  const queryTerms = normalizeQueryTerms(query ?? "");
  if (queryTerms.length === 0) {
    return sections;
  }

  return sections
    .map((section) => {
      const haystack = `${section.title}\n${section.content.slice(0, 4000)}`.toLowerCase();
      const matchScore = queryTerms.reduce((score, term) => {
        let nextScore = score;
        if (section.title.toLowerCase().includes(term)) {
          nextScore += 2;
        }
        if (haystack.includes(term)) {
          nextScore += 1;
        }
        return nextScore;
      }, 0);

      return {
        ...section,
        matchScore
      };
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }
      return left.index - right.index;
    });
}

function locateChunkSpans(text: string, chunks: Array<{ id?: number; chunkIndex: number; content: string; metadata?: Record<string, unknown> }>): ChunkSpan[] {
  let searchStart = 0;

  return chunks.map((chunk) => {
    const normalizedContent = normalizeDocumentText(chunk.content);
    const relaxedStart = Math.max(0, searchStart - 256);
    let startOffset = text.indexOf(normalizedContent, relaxedStart);

    if (startOffset < 0) {
      const fallbackNeedle = normalizedContent.slice(0, Math.min(normalizedContent.length, 160));
      startOffset = fallbackNeedle ? text.indexOf(fallbackNeedle, relaxedStart) : -1;
    }
    if (startOffset < 0) {
      startOffset = Math.min(relaxedStart, text.length);
    }

    const endOffset = Math.min(text.length, startOffset + normalizedContent.length);
    searchStart = endOffset;

    return {
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      content: normalizedContent,
      startOffset,
      endOffset,
      metadata: chunk.metadata
    };
  });
}

function findSectionForOffsets(sections: DocumentSection[], chunk: ChunkSpan): DocumentSection | null {
  let bestMatch: DocumentSection | null = null;
  let bestOverlap = -1;

  for (const section of sections) {
    const overlap = Math.min(section.endOffset, chunk.endOffset) - Math.max(section.startOffset, chunk.startOffset);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = section;
    }
  }

  return bestMatch;
}

async function insertSections(client: PoolClient, documentId: number, sections: DocumentSection[]): Promise<DocumentSection[]> {
  await client.query("DELETE FROM document_sections WHERE document_id = $1", [documentId]);
  const storedSections: DocumentSection[] = [];

  for (const section of sections) {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO document_sections (
          document_id,
          section_index,
          title,
          content,
          preview,
          start_offset,
          end_offset,
          section_type,
          metadata,
          page_start,
          page_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        documentId,
        section.index,
        section.title,
        section.content,
        section.preview,
        section.startOffset,
        section.endOffset,
        section.sectionType,
        JSON.stringify(section.metadata ?? {}),
        section.pageStart,
        section.pageEnd
      ]
    );

    storedSections.push({ ...section, id: result.rows[0].id });
  }

  return storedSections;
}

async function fetchChunkRows(client: PoolClient, documentId: number): Promise<ChunkRow[]> {
  const result = await client.query<ChunkRow>(
    `
      SELECT id, chunk_index, content, metadata
      FROM document_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC
    `,
    [documentId]
  );

  return result.rows;
}

async function updateChunkSectionLinks(client: PoolClient, documentId: number, sections: DocumentSection[], chunkSpans?: ChunkSpan[]) {
  const chunks = chunkSpans ?? locateChunkSpans(
    normalizeDocumentText((await client.query<{ extracted_text: string }>("SELECT extracted_text FROM documents WHERE id = $1", [documentId])).rows[0]?.extracted_text ?? ""),
    (await fetchChunkRows(client, documentId)).map((row) => ({
      id: row.id,
      chunkIndex: row.chunk_index,
      content: row.content,
      metadata: row.metadata ?? {}
    }))
  );

  for (const chunk of chunks) {
    if (!chunk.id) {
      continue;
    }

    const section = findSectionForOffsets(sections, chunk);
    const metadata = {
      ...(chunk.metadata ?? {}),
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      ...(section
        ? {
            sectionIndex: section.index,
            sectionTitle: section.title,
            sectionType: section.sectionType
          }
        : {})
    };

    await client.query(
      `
        UPDATE document_chunks
        SET
          document_section_id = $2,
          start_offset = $3,
          end_offset = $4,
          metadata = $5::jsonb
        WHERE id = $1
      `,
      [chunk.id, section?.id ?? null, chunk.startOffset, chunk.endOffset, JSON.stringify(metadata)]
    );
  }
}

export async function persistDocumentStructure(
  client: PoolClient,
  options: {
    documentId: number;
    text: string;
    chunkSpans?: ChunkSpan[];
  }
): Promise<DocumentSection[]> {
  const normalizedText = normalizeDocumentText(options.text);
  const sections = deriveDocumentSections(normalizedText);
  const storedSections = await insertSections(client, options.documentId, sections);
  await updateChunkSectionLinks(client, options.documentId, storedSections, options.chunkSpans);
  await client.query(
    `
      UPDATE documents
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $1
    `,
    [
      options.documentId,
      JSON.stringify({
        structureVersion: DOCUMENT_STRUCTURE_VERSION,
        structureSectionCount: storedSections.length,
        structureUpdatedAt: new Date().toISOString()
      })
    ]
  );
  return storedSections;
}

export async function backfillStoredDocumentStructures(batchSize = 100): Promise<{ processed: number }> {
  const client = await pool.connect();
  let processed = 0;
  let locked = false;

  try {
    const lockResult = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [DOCUMENT_STRUCTURE_BACKFILL_LOCK]);
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) {
      return { processed: 0 };
    }

    while (true) {
      const result = await client.query<DocumentRow>(
        `
          SELECT
            d.id,
            d.title,
            d.source_type,
            d.source_ref,
            d.source_url,
            d.mime_type,
            d.file_type,
            d.extracted_text,
            d.metadata,
            d.created_at::text,
            d.updated_at::text
          FROM documents d
          WHERE NOT EXISTS (
            SELECT 1 FROM document_sections ds WHERE ds.document_id = d.id
          )
          OR COALESCE((d.metadata ->> 'structureVersion')::integer, 0) < $2
          ORDER BY d.id ASC
          LIMIT $1
        `,
        [batchSize, DOCUMENT_STRUCTURE_VERSION]
      );

      if (result.rowCount === 0) {
        break;
      }

      for (const row of result.rows) {
        await client.query("BEGIN");
        try {
          await persistDocumentStructure(client, {
            documentId: row.id,
            text: row.extracted_text
          });
          await client.query("COMMIT");
          processed += 1;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    return { processed };
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [DOCUMENT_STRUCTURE_BACKFILL_LOCK]);
    }
    client.release();
  }
}

async function loadStoredSections(documentId: number): Promise<DocumentSection[]> {
  const result = await pool.query<StoredSectionRow>(
    `
      SELECT
        id,
        section_index,
        title,
        content,
        preview,
        start_offset,
        end_offset,
        section_type,
        metadata,
        page_start,
        page_end
      FROM document_sections
      WHERE document_id = $1
      ORDER BY section_index ASC
    `,
    [documentId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    index: row.section_index,
    title: row.title,
    content: row.content,
    preview: row.preview,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    matchScore: 0,
    sectionType: row.section_type,
    metadata: row.metadata ?? {},
    pageStart: row.page_start,
    pageEnd: row.page_end
  }));
}

export async function findDocument(options: { documentId?: number; sourceRef?: string; allowedKnowledgeBaseIds?: number[] }): Promise<DocumentRecord | null> {
  const trimmedSourceRef = options.sourceRef?.trim();
  const normalizedSourceRef = trimmedSourceRef
    ? trimmedSourceRef.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
    : null;
  const locatorTerms = buildDocumentLocatorTerms(trimmedSourceRef);
  if (!options.documentId && !trimmedSourceRef) {
    return null;
  }

  const result = await pool.query<DocumentRow>(
    `
      SELECT
        id,
        title,
        source_type,
        source_ref,
        source_url,
        mime_type,
        file_type,
        extracted_text,
        metadata,
        created_at::text,
        updated_at::text
      FROM documents
      WHERE (
          $4::bigint[] IS NULL
          OR (cardinality($4::bigint[]) > 0 AND knowledge_base_id = ANY($4::bigint[]))
        )
        AND (($1::bigint IS NOT NULL AND id = $1::bigint)
         OR (
           $2::text IS NOT NULL
           AND (
             lower(source_ref) = lower($2::text)
             OR lower(COALESCE(title, '')) = lower($2::text)
             OR lower(source_ref) LIKE '%' || lower($2::text) || '%'
             OR lower(COALESCE(title, '')) LIKE '%' || lower($2::text) || '%'
             OR lower(COALESCE(metadata->>'uploadedFileName', '')) = lower($2::text)
             OR lower(COALESCE(metadata->>'uploadedFileName', '')) LIKE '%' || lower($2::text) || '%'
             OR regexp_replace(lower(source_ref), '[^[:alnum:]]+', '', 'g') = $3::text
             OR regexp_replace(lower(COALESCE(title, '')), '[^[:alnum:]]+', '', 'g') = $3::text
             OR regexp_replace(lower(COALESCE(metadata->>'uploadedFileName', '')), '[^[:alnum:]]+', '', 'g') = $3::text
             OR regexp_replace(lower(source_ref), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%'
             OR regexp_replace(lower(COALESCE(title, '')), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%'
             OR regexp_replace(lower(COALESCE(metadata->>'uploadedFileName', '')), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%'
           )
        ))
      ORDER BY
        CASE
          WHEN $1::bigint IS NOT NULL AND id = $1::bigint THEN 0
          WHEN $2::text IS NOT NULL AND lower(source_ref) = lower($2::text) THEN 1
          WHEN $2::text IS NOT NULL AND lower(COALESCE(title, '')) = lower($2::text) THEN 2
          WHEN $2::text IS NOT NULL AND lower(COALESCE(metadata->>'uploadedFileName', '')) = lower($2::text) THEN 3
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(source_ref), '[^[:alnum:]]+', '', 'g') = $3::text THEN 4
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(COALESCE(title, '')), '[^[:alnum:]]+', '', 'g') = $3::text THEN 5
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(COALESCE(metadata->>'uploadedFileName', '')), '[^[:alnum:]]+', '', 'g') = $3::text THEN 6
          WHEN $2::text IS NOT NULL AND lower(source_ref) LIKE '%' || lower($2::text) || '%' THEN 7
          WHEN $2::text IS NOT NULL AND lower(COALESCE(title, '')) LIKE '%' || lower($2::text) || '%' THEN 8
          WHEN $2::text IS NOT NULL AND lower(COALESCE(metadata->>'uploadedFileName', '')) LIKE '%' || lower($2::text) || '%' THEN 9
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(source_ref), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%' THEN 10
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(COALESCE(title, '')), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%' THEN 11
          WHEN $3::text IS NOT NULL AND regexp_replace(lower(COALESCE(metadata->>'uploadedFileName', '')), '[^[:alnum:]]+', '', 'g') LIKE '%' || $3::text || '%' THEN 12
          ELSE 13
        END,
        updated_at DESC,
        id DESC
      LIMIT 1
    `,
    [options.documentId ?? null, trimmedSourceRef ?? null, normalizedSourceRef, options.allowedKnowledgeBaseIds ?? null]
  );

  if (result.rowCount === 0) {
    if (!trimmedSourceRef || locatorTerms.length === 0) {
      return null;
    }

    const fallbackResult = await pool.query<DocumentRow & { locator_score: number }>(
      `
        WITH query_terms AS (
          SELECT DISTINCT term
          FROM unnest($1::text[]) AS term
          WHERE char_length(term) >= 3
        ),
        candidates AS (
          SELECT
            d.id,
            d.title,
            d.source_type,
            d.source_ref,
            d.source_url,
            d.mime_type,
            d.file_type,
            d.extracted_text,
            d.metadata,
            d.created_at::text,
            d.updated_at::text,
            (
              SELECT COUNT(*)
              FROM query_terms qt
              WHERE lower(concat_ws(
                ' ',
                COALESCE(d.source_ref, ''),
                COALESCE(d.title, ''),
                COALESCE(d.metadata->>'uploadedFileName', ''),
                COALESCE(d.metadata->>'storedFileName', ''),
                COALESCE(d.metadata->>'filePath', ''),
                COALESCE(d.metadata->>'documentType', ''),
                COALESCE(d.metadata->'classification'->>'summary', ''),
                left(COALESCE(d.extracted_text, ''), 4000)
              )) LIKE '%' || qt.term || '%'
            ) AS locator_score
          FROM documents d
          WHERE (
              $2::bigint[] IS NULL
              OR (cardinality($2::bigint[]) > 0 AND d.knowledge_base_id = ANY($2::bigint[]))
            )
        )
        SELECT
          id,
          title,
          source_type,
          source_ref,
          source_url,
          mime_type,
          file_type,
          extracted_text,
          metadata,
          created_at,
          updated_at,
          locator_score
        FROM candidates
        WHERE locator_score > 0
        ORDER BY
          locator_score DESC,
          updated_at DESC,
          id DESC
        LIMIT 1
      `,
      [locatorTerms, options.allowedKnowledgeBaseIds ?? null]
    );

    if (fallbackResult.rowCount === 0) {
      return null;
    }

    const row = fallbackResult.rows[0];
    return {
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      sourceUrl: row.source_url,
      mimeType: row.mime_type,
      fileType: row.file_type,
      extractedText: row.extracted_text,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    mimeType: row.mime_type,
    fileType: row.file_type,
    extractedText: row.extracted_text,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getDocumentSections(options: {
  documentId?: number;
  sourceRef?: string;
  query?: string;
  limit?: number;
  allowedKnowledgeBaseIds?: number[];
}): Promise<{ document: DocumentRecord; sections: DocumentSection[] } | null> {
  const document = await findDocument(options);
  if (!document) {
    return null;
  }

  let sections = await loadStoredSections(document.id);
  if (sections.length === 0) {
    sections = deriveDocumentSections(document.extractedText);
  }

  const ranked = rankDocumentSections(sections, options.query);
  const limit = Math.min(Math.max(options.limit ?? ranked.length, 1), 50);

  return {
    document,
    sections: ranked.slice(0, limit)
  };
}

export async function getDocumentSection(options: {
  documentId?: number;
  sourceRef?: string;
  sectionIndex?: number;
  query?: string;
  allowedKnowledgeBaseIds?: number[];
}): Promise<{ document: DocumentRecord; section: DocumentSection } | null> {
  const result = await getDocumentSections({
    documentId: options.documentId,
    sourceRef: options.sourceRef,
    query: options.query,
    limit: 50
  });

  if (!result || result.sections.length === 0) {
    return null;
  }

  const section = typeof options.sectionIndex === "number"
    ? result.sections.find((entry) => entry.index === options.sectionIndex)
    : result.sections[0];

  if (!section) {
    return null;
  }

  return {
    document: result.document,
    section
  };
}

export async function getDocumentStructure(options: {
  documentId?: number;
  sourceRef?: string;
  limit?: number;
  allowedKnowledgeBaseIds?: number[];
}): Promise<{ document: DocumentRecord; documentType: string; nodes: DocumentStructureNode[] } | null> {
  const result = await getDocumentSections({
    documentId: options.documentId,
    sourceRef: options.sourceRef,
    limit: options.limit ?? 100
  });

  if (!result) {
    return null;
  }

  return {
    document: result.document,
    documentType: inferDocumentType(result.document),
    nodes: result.sections.map((section) => ({
      id: section.id,
      index: section.index,
      title: section.title,
      level: inferSectionLevel(section.title, section.sectionType),
      sectionType: section.sectionType,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      preview: section.preview,
      metadata: section.metadata
    }))
  };
}
