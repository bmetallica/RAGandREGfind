CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_documents_lookup_trgm
  ON documents USING GIN (
    lower(regexp_replace(COALESCE(title, '') || ' ' || COALESCE(source_ref, ''), '[^[:alnum:]]+', ' ', 'g'))
    gin_trgm_ops
  );