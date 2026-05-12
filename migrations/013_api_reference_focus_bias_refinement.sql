UPDATE document_type_settings
SET prefer_content_matches = FALSE
WHERE key = 'api_reference'
  AND search_profile = 'code'
  AND prefer_content_matches = TRUE
  AND prefer_document_focus = TRUE
  AND require_focus_terms = TRUE
  AND prefer_adjacent_sections = FALSE
  AND small_to_big_window = 0;
