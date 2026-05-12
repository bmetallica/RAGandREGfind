CREATE TABLE IF NOT EXISTS document_sections (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  preview TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'generic',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, section_index)
);

CREATE INDEX IF NOT EXISTS idx_document_sections_document_id ON document_sections (document_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_section_type ON document_sections (section_type);

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS document_section_id BIGINT REFERENCES document_sections(id) ON DELETE SET NULL;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS start_offset INTEGER;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS end_offset INTEGER;

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_section_id ON document_chunks (document_section_id);