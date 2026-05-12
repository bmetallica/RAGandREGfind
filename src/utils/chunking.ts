export interface ChunkResult {
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  startOffset: number;
  endOffset: number;
}

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
}

export function normalizeDocumentText(input: string): string {
  return input.replace(/\r/g, "").replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function locateChunkOffsets(text: string, chunks: Omit<ChunkResult, "startOffset" | "endOffset">[], overlap: number): ChunkResult[] {
  let searchStart = 0;

  return chunks.map((chunk) => {
    const normalizedContent = chunk.content.trim();
    const relaxedSearchStart = Math.max(0, searchStart - overlap - 32);
    let startOffset = text.indexOf(normalizedContent, relaxedSearchStart);

    if (startOffset < 0) {
      const fallbackNeedle = normalizedContent.slice(0, Math.min(normalizedContent.length, 160));
      startOffset = fallbackNeedle ? text.indexOf(fallbackNeedle, relaxedSearchStart) : -1;
    }

    if (startOffset < 0) {
      startOffset = Math.min(relaxedSearchStart, text.length);
    }

    const endOffset = Math.min(text.length, startOffset + normalizedContent.length);
    searchStart = endOffset;

    return {
      ...chunk,
      startOffset,
      endOffset
    };
  });
}

export function smartChunkText(input: string, options: ChunkingOptions): ChunkResult[] {
  const text = normalizeDocumentText(input);
  if (!text) {
    return [];
  }

  const paragraphs = text.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: Omit<ChunkResult, "startOffset" | "endOffset">[] = [];
  let buffer = "";
  let chunkIndex = 0;

  const flush = () => {
    const content = buffer.trim();
    if (!content) {
      buffer = "";
      return;
    }

    chunks.push({
      chunkIndex,
      content,
      tokenEstimate: Math.ceil(content.length / 4)
    });
    chunkIndex += 1;

    const overlapStart = Math.max(0, content.length - options.overlap);
    buffer = content.slice(overlapStart);
  };

  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

    if (next.length <= options.chunkSize) {
      buffer = next;
      continue;
    }

    if (buffer) {
      flush();
    }

    if (paragraph.length <= options.chunkSize) {
      buffer = paragraph;
      continue;
    }

    let offset = 0;
    while (offset < paragraph.length) {
      const slice = paragraph.slice(offset, offset + options.chunkSize);
      chunks.push({
        chunkIndex,
        content: slice.trim(),
        tokenEstimate: Math.ceil(slice.length / 4)
      });
      chunkIndex += 1;
      offset += Math.max(1, options.chunkSize - options.overlap);
    }
    buffer = "";
  }

  if (buffer) {
    flush();
  }

  return locateChunkOffsets(text, chunks, options.overlap);
}
