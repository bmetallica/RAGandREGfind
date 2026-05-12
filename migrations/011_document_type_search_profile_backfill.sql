UPDATE document_type_settings
SET search_profile = 'structured',
    prefer_content_matches = TRUE,
    prefer_document_focus = TRUE,
    require_focus_terms = TRUE,
    prefer_adjacent_sections = TRUE,
    adjacent_section_window = 1,
    small_to_big_window = 1,
    updated_at = NOW()
WHERE key IN ('protocol', 'documentation', 'runbook', 'ticket', 'changelog');

UPDATE document_type_settings
SET search_profile = 'reference',
    prefer_content_matches = TRUE,
    prefer_document_focus = TRUE,
    require_focus_terms = TRUE,
    prefer_adjacent_sections = TRUE,
    adjacent_section_window = 1,
    small_to_big_window = 1,
    updated_at = NOW()
WHERE key IN ('paper', 'manual', 'web');

UPDATE document_type_settings
SET search_profile = 'record',
    prefer_content_matches = TRUE,
    prefer_document_focus = TRUE,
    require_focus_terms = TRUE,
    prefer_adjacent_sections = TRUE,
    adjacent_section_window = 1,
    small_to_big_window = 1,
    updated_at = NOW()
WHERE key IN ('policy', 'contract', 'invoice', 'email');

UPDATE document_type_settings
SET search_profile = 'code',
    prefer_content_matches = TRUE,
    prefer_document_focus = TRUE,
    require_focus_terms = TRUE,
    prefer_adjacent_sections = CASE WHEN key = 'source_code' THEN TRUE ELSE FALSE END,
    adjacent_section_window = CASE WHEN key = 'source_code' THEN 1 ELSE 0 END,
    small_to_big_window = 0,
    updated_at = NOW()
WHERE key IN ('api_reference', 'config', 'source_code');

UPDATE document_type_settings
SET search_profile = 'narrative',
    prefer_content_matches = TRUE,
    prefer_document_focus = TRUE,
    require_focus_terms = TRUE,
    prefer_adjacent_sections = TRUE,
    adjacent_section_window = 3,
    small_to_big_window = 2,
    updated_at = NOW()
WHERE key = 'book';