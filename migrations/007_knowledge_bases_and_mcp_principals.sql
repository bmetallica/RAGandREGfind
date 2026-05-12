CREATE TABLE IF NOT EXISTS knowledge_bases (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO knowledge_bases (slug, name, description)
VALUES ('default', 'Default', 'Bestandsdokumente und globaler Wissensraum')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS knowledge_base_id BIGINT REFERENCES knowledge_bases(id) ON DELETE SET NULL;

UPDATE documents
SET knowledge_base_id = kb.id
FROM knowledge_bases kb
WHERE kb.slug = 'default'
  AND documents.knowledge_base_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base_id ON documents(knowledge_base_id);

CREATE TABLE IF NOT EXISTS mcp_principals (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  principal_type TEXT NOT NULL DEFAULT 'service_account',
  token_hash TEXT NOT NULL UNIQUE,
  token_preview TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS principal_knowledge_bases (
  principal_id BIGINT NOT NULL REFERENCES mcp_principals(id) ON DELETE CASCADE,
  knowledge_base_id BIGINT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  PRIMARY KEY (principal_id, knowledge_base_id)
);

CREATE INDEX IF NOT EXISTS idx_principal_knowledge_bases_kb_id ON principal_knowledge_bases(knowledge_base_id);
