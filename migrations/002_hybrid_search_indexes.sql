CREATE INDEX IF NOT EXISTS idx_document_chunks_content_tsv
  ON document_chunks USING GIN (to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS idx_documents_lookup_tsv
  ON documents USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(source_ref, '')));