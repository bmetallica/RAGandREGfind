CREATE TABLE IF NOT EXISTS document_artifacts (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_section_id BIGINT REFERENCES document_sections(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  content TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, document_section_id, artifact_type, artifact_key)
);

CREATE INDEX IF NOT EXISTS idx_document_artifacts_document_id
  ON document_artifacts (document_id);

CREATE INDEX IF NOT EXISTS idx_document_artifacts_section_id
  ON document_artifacts (document_section_id);

CREATE INDEX IF NOT EXISTS idx_document_artifacts_type
  ON document_artifacts (artifact_type);