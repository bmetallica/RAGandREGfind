CREATE TABLE IF NOT EXISTS document_files (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  storage_kind TEXT NOT NULL DEFAULT 'local',
  relative_path TEXT,
  original_name TEXT,
  stored_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  content_hash TEXT,
  external_url TEXT,
  local_available BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_files_document_id
  ON document_files (document_id);

CREATE INDEX IF NOT EXISTS idx_document_files_storage_kind
  ON document_files (storage_kind);

CREATE INDEX IF NOT EXISTS idx_document_files_external_url
  ON document_files (external_url);