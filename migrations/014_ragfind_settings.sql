CREATE TABLE IF NOT EXISTS ragfind_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  knowledge_base_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ragfind_settings (singleton, knowledge_base_ids)
SELECT
  TRUE,
  COALESCE(
    ARRAY(
      SELECT kb.id::BIGINT
      FROM knowledge_bases kb
      WHERE kb.slug = 'default'
        AND kb.is_enabled = TRUE
      ORDER BY kb.id ASC
      LIMIT 1
    ),
    '{}'::BIGINT[]
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM ragfind_settings
  WHERE singleton = TRUE
);