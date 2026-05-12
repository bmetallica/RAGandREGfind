UPDATE document_type_settings
SET
  prefer_content_matches = FALSE,
  adjacent_section_window = 0
WHERE key = 'api_reference'
  AND search_profile = 'code'
  AND prefer_content_matches = TRUE
  AND prefer_document_focus = TRUE
  AND require_focus_terms = TRUE
  AND prefer_adjacent_sections = FALSE
  AND adjacent_section_window = 1
  AND small_to_big_window = 0;

UPDATE document_type_settings
SET
  prefer_adjacent_sections = FALSE,
  adjacent_section_window = 0,
  small_to_big_window = 0
WHERE key = 'email'
  AND search_profile = 'record'
  AND prefer_content_matches = TRUE
  AND prefer_document_focus = TRUE
  AND require_focus_terms = TRUE
  AND prefer_adjacent_sections = TRUE
  AND adjacent_section_window = 1
  AND small_to_big_window = 1;

UPDATE document_type_settings
SET
  prefer_adjacent_sections = FALSE,
  adjacent_section_window = 0
WHERE key = 'source_code'
  AND search_profile = 'code'
  AND prefer_content_matches = TRUE
  AND prefer_document_focus = TRUE
  AND require_focus_terms = TRUE
  AND prefer_adjacent_sections = TRUE
  AND adjacent_section_window = 1
  AND small_to_big_window = 0;
