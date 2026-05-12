CREATE TABLE IF NOT EXISTS document_type_settings (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'generic',
  prompt_hint TEXT NOT NULL DEFAULT '',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_type_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_type_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_type_settings_enabled ON document_type_settings (enabled, priority, key);