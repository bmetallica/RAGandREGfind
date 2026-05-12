# RAG Platform Roadmap

## Zielbild

Ziel ist nicht mehr nur ein dokumentzentriertes Retrieval-System, sondern eine dokumentzentrierte, mehrmandantenfaehige RAG-Plattform mit klarer Trennung zwischen Source of Truth, Suchindex, Orchestrierung und Tool-Consumer.

Die Zielarchitektur lautet:

- PostgreSQL plus pgvector bleibt Source of Truth fuer Dokumente, Sections, Chunks, Embeddings, Metadaten, Extraktionen, Summaries, Versionen, Originaldateien und ACL-Kontext.
- OpenSearch oder Elasticsearch wird als optionale zweite Suchschicht fuer BM25, Volltext, Fuzzy Search, Filter, Facetten, Highlighting und Hybrid Candidate Retrieval eingeplant.
- MCP- und HTTP-API bilden den zentralen Orchestrierungs-, Routing- und Berechtigungs-Layer.
- Open WebUI bleibt Frontend, Tool-Consumer und Integrationsoberflaeche, aber nicht die primaere Fachlogik.
- Ein kleines externes LLM klassifiziert Dokumente beim Ingest oder Reclassify-Lauf in Typen, Traits und Processing Profiles.

Das System soll:

- Antworten moeglichst gegen konkrete Dokumente oder klare Dokumentbereiche formulieren.
- Strukturinformationen wie Kapitel, Listen, Tabellen, Agenda, Klauseln, Symbole und Seitenanker vor reiner Embedding-Naehe priorisieren.
- Retrieval, Volltext, Abschnittsabruf, Vergleich, Extraktion und Zusammenfassung als getrennte Wissensoperationen behandeln.
- fuer mehrere Knowledge Bases, Collections und Zugriffskontexte sicher und nachvollziehbar arbeiten.
- zitierfaehige Antwortpakete mit Evidenz, Abschnitt, Seitenbereich und Originalquelle liefern.

## Feste Architekturentscheidungen

Diese Punkte gelten als bewusst gesetzte Leitplanken fuer die weitere Umsetzung:

- PostgreSQL plus pgvector bleibt Source of Truth.
- OpenSearch oder Elasticsearch wird als Search Layer explizit eingeplant, aber nicht als alleinige Wahrheit.
- MCP und HTTP-API bleiben die zentrale Orchestrierungs- und Berechtigungsschicht.
- Open WebUI bleibt UI und Tool-Consumer, nicht der Ort fuer Kernlogik oder Rechteentscheidungen.
- Dokumente werden beim Ingest automatisch klassifiziert und profilgesteuert verarbeitet.
- Das Klassifikations-LLM laeuft extern ueber Ollama oder einen OpenAI-kompatiblen Endpoint, nicht auf derselben Maschine wie das Kernsystem.
- Knowledge Bases werden als First-Class-Objekte eingefuehrt.
- Zugriff wird principal- und gruppenbasiert ueber MCP-Authentifizierung und Backend-ACLs gesteuert.
- ACL wird vor Retrieval, nicht erst nachtraeglich, erzwungen.
- Antworten muessen auf Dokument, Abschnitt, Seite und Originalquelle rueckfuehrbar sein.

## Status heute

Bereits vorhanden:

- Ingestion fuer Upload, Crawl und Import-Verzeichnis
- Git-Repository-Ingestion mit Branch- und Subpfad-Scope
- OCR-Fallback und Deduplizierung
- PostgreSQL plus pgvector als persistente Kernhaltung
- optionale Elasticsearch-Schicht fuer Hybrid-Signale
- heuristische Dokumentstruktur mit Sections und Chunk-Verknuepfung
- Smart Search, Dashboard und MCP-Toolserver
- Admin-Auth sowie Principal-/Knowledge-Base-Zuordnung fuer MCP/API-Zugriffe
- dokumenttypzentrierte Registry im Admin-UI mit editierbaren Suchprofilen
- serverseitige Extraktionen, Zusammenfassungen, Vergleiche und Cross-Reference-Grundfunktionen
- persistierte Originaldatei-Referenzen mit Download-Link
- separates Endnutzer-Frontend `RAGfind` auf Port 3312
- konfigurierbare KB-Scope fuer `RAGfind` im Admin-UI
- lokaler Multisource-Viewer fuer Crawl-, Markdown-, Code- und Textinhalte in `RAGfind`
- verbesserter Crawl-Pfad fuer Redirect-Domaenen wie `bmetallica.de -> www.bmetallica.de`

Noch nicht ausreichend ausgebaut:

- echte Multi-Knowledge-Base- und ACL-Architektur
- dokumenttypspezifische Klassifikation mit Traits und Processing Profiles
- profilgesteuertes Chunking, Sectioning und Retrieval
- strukturierte Antwortpakete mit durchgaengigem Quellen- und Trace-Modell
- fruehe, systematische Retrieval- und ACL-Evaluierung
- optionale zweite Suchschicht fuer grosse Dokumentbestaende

## Kurzfristige Produktnaechste Schritte

- RAGfind-Viewer weiter in Richtung produktionsreife Dokumentansicht ausbauen, inklusive besserer Navigation zwischen Render- und Rohansicht
- Crawl-Qualitaet fuer komplexere Sites weiter absichern, zum Beispiel Canonical-, Robots- und Sitemap-Unterstuetzung
- Retrieval-Evaluierung systematisieren, insbesondere fuer Open WebUI-, Git- und Website-lastige Suchanfragen
- Antwortpakete mit staerkeren Quellenhinweisen und Debug-Trace fuer anspruchsvollere Tool-Consumer ausbauen

## Leitprinzipien

1. Dokumente zuerst  
   Fragen sollen moeglichst gegen ein konkretes Dokument oder einen klaren Dokumentbereich beantwortet werden, bevor breit ueber den gesamten Index gesucht wird.

2. Struktur vor Semantik  
   Ueberschriften, Kapitel, Listen, Tabellen, Agenda, Klauseln, Seitenanker und Symbole sind fuer viele Fragen wichtiger als reine Embeddings.

3. Retrieval ist nicht Nutzung  
   Suche allein reicht nicht. Das System braucht separate Werkzeuge fuer Volltext, Abschnitte, Vergleich, Extraktion und Zusammenfassung.

4. Pruefbarkeit und Rueckfuehrbarkeit  
   Jede hochwertige Antwort muss auf Dokument, Abschnitt, Seite, Evidenz und Originalquelle zurueckfuehrbar sein.

5. Ein Pfad fuer Logik  
   Dashboard, HTTP-API, Open WebUI und MCP greifen auf dieselben Kernfunktionen fuer Routing, Retrieval, ACL und Dokumentzugriff zu.

6. ACL vor Retrieval  
   Erlaubte Knowledge Bases und Collections werden vor jeder Suche bestimmt. Es gibt keine globale Suche mit nachtraeglichem Wegfiltern.

## Zielarchitektur im Detail

### 1. Datenhaltung und Suche

- PostgreSQL plus pgvector: Source of Truth fuer Dokumente, Sections, Chunks, Embeddings, Versionen, Extraktionen, Summaries, Originaldateien und ACL-Kontext
- OpenSearch oder Elasticsearch: optionale Suchschicht fuer BM25, Fuzzy, Highlighting, Facetten, Filter und Hybrid Candidate Retrieval
- MCP und HTTP-API: zentraler Orchestrator fuer Authentifizierung, Rechte, Query-Intent, Tool-Routing und Ergebnisaufbereitung
- Open WebUI: Frontend und Tool-Consumer, keine primaere Wahrheit

### 2. Dokumentklassifikation und Profilwahl

Ziel ist, Dokumente nicht manuell typisieren zu muessen und trotzdem keine uniforme Pipeline auf alles anzuwenden.

Der Klassifikationspfad soll kombinieren:

- Heuristiken ueber MIME, Pfad, Dateiname, Quelle und Marker
- Strukturhinweise aus Ueberschriften, Tabellen, Listen, Code-Fences, Klauseln und Seitenlayout
- kleines externes LLM fuer die semantische Einordnung
- Fallback auf `generic_text`, wenn die Einordnung unsicher ist

Der Klassifikationsoutput soll mindestens enthalten:

- `primary_type`
- `secondary_types`
- `traits`
- `processing_profile`
- `recommended_chunking`
- `recommended_sectioning`
- `recommended_extractions`
- `confidence`
- `signals`
- `reasoning_short`

Externe Konfiguration fuer das Klassifikations-LLM:

- `CLASSIFIER_LLM_BASE_URL`
- `CLASSIFIER_LLM_MODEL`
- `CLASSIFIER_LLM_TIMEOUT`

### 3. Dokumenttypen, Traits und Processing Profiles

Empfohlene Primary Types fuer den produktiven Start:

- `generic_text`
- `web_article`
- `documentation_website`
- `book`
- `scientific_paper`
- `technical_report`
- `meeting_minutes`
- `transcript`
- `policy`
- `contract`
- `code_documentation`
- `source_code_file`
- `api_reference`
- `runbook_or_ops_doc`
- `changelog_release_notes`
- `spreadsheet_or_table_doc`
- `presentation_slides`
- `requirement_spec`
- `document_collection`
- `pdf_scanned`

Wichtige Traits:

- `has_tables`
- `has_code_blocks`
- `has_references`
- `has_agenda`
- `has_action_items`
- `has_deadlines`
- `has_api_endpoints`
- `has_config_keys`
- `is_ocr`
- `ocr_low_confidence`
- `is_multilingual`
- `is_scanned`
- `is_threaded`
- `is_time_series`
- `is_versioned`
- `is_primary_source`
- `is_structured_data`

Empfohlene Processing Profiles:

- `generic_text`
- `web_structured`
- `book_hierarchical`
- `paper_structured`
- `meeting_structured`
- `policy_legal`
- `code_structured`
- `source_code_symbolic`
- `table_structured`
- `slide_structured`
- `ocr_resilient`
- `bundle_splitter`

Konsequenz:

- Chunking und Sectioning laufen profilgesteuert.
- Extraktionen laufen profilgesteuert.
- Retrieval-Gewichtung und Toolwahl koennen profilgesteuert sein.

### 4. Mehrmandantenfaehigkeit und Wissensraeume

Fachliches Modell:

- `knowledge_base` als eigentlicher Wissensraum
- `collection` als Untergliederung innerhalb einer Knowledge Base
- Dokumente, Sections, Chunks und Originaldateien tragen den KB-Kontext mit

Beispiele:

- `kb_vereinsprotokolle`
- `kb_wissenschaft`
- `kb_code`
- `kb_policies`

Wichtiger Grundsatz:

- erlaubte Knowledge Bases werden vor dem Retrieval bestimmt
- gesucht wird nur innerhalb dieser erlaubten KBs
- danach folgen Ranking, Expansion und Reranking

### 5. Gruppenrechte und Integrationsauth

Zielmodell:

- Gruppe A darf auf Knowledge Base A und B
- Gruppe B darf auf Knowledge Base B
- jede Integration oder jeder Zugriffskontext bekommt einen eigenen MCP-Zugang mit eigener Authentifizierung

Empfohlenes Kernmodell:

- `knowledge_bases`
- `collections`
- `access_groups`
- `access_group_knowledge_bases`
- `mcp_principals` oder `service_accounts`
- `principal_groups`

Verbindliche Regeln:

- jede Suche und jeder Dokumentzugriff prueft ACL serverseitig
- das gilt fuer Search, Volltext, Abschnitte, Summaries, Extraktionen, Vergleiche und Originaldatei-Downloads
- keine globale Suche ohne KB-Scope
- Open WebUI bleibt einfach und nutzt pro Gruppe oder Integration eigene Credentials

### 6. Antwortpakete und Nachvollziehbarkeit

Antworten sollen mindestens enthalten:

- eigentliche Antwort
- genutzte Quelle(n)
- Dokument-ID und Titel
- Abschnitt und Seitenbereich
- Evidenz-Snippets
- Originaldatei-Link oder Preview-Link
- Confidence
- optional Tool-Trace oder Debug-Infos

## Neue und erweiterte Arbeitsstraenge

## 1. Dokumentklassifikation und Profilwahl

Ziel:
Dokumente automatisch klassifizieren und einem Verarbeitungsprofil zuordnen.

Deliverables:

- heuristische Voranalyse auf Basis von MIME, Dateiname, Quelle, Marker und Strukturhinweisen
- externes Klassifikations-LLM via Ollama oder OpenAI-kompatible API
- Prompt plus JSON-Schema fuer Typ-, Trait- und Profilklassifikation
- Persistenz von Typ, Traits, Profil, Confidence, Modellversion und Prompt-Version
- Reclassify- und Backfill-Pipeline
- Fallback auf `generic_text`

## 2. Processing Profiles und profilgesteuerte Ingestion

Ziel:
Chunking, Sectioning und Extraktion profilgesteuert umsetzen.

Deliverables:

- Mapping `processing_profile -> Ingestion-Konfiguration`
- profilgesteuerte Chunking-Strategien
- profilgesteuerte Sectioning-Logik
- profilgesteuerte Extraktionspipelines
- Versionierung der Processing Profiles

## 3. Retrieval und Navigation

Ziel:
Dokumentzentrierte Navigation, profilgesteuerte Suche und differenzierte Retrieval-Pfade ausbauen.

Deliverables:

- Dokument-, Section- und Compare-Flows als eigenstaendige Nutzungspfade
- Retrieval-Modi `semantic_only`, `lexical_only`, `hybrid`, `document_first`, `section_first`
- Small-to-Big und Reranking profilgesteuert steuern
- Query-Intent und Query-Policy im MCP- und API-Layer
- strukturierte Antwortpakete mit Evidenz und Quellenkarten

## 4. Multi-Knowledge-Base und Wissensraeume

Ziel:
Mehrere logisch getrennte Wissensdatenbanken mit eigener Verwaltung und Nutzung unterstuetzen.

Deliverables:

- `knowledge_base` als First-Class-Objekt
- `collection`-Ebene
- KB-Zuordnung auf Dokumentenebene mit Vererbung auf Sections, Chunks und Dateien
- KB-Filter in allen Such-, Dokument- und Analyse-Tools
- UI- und Admin-Funktionen zur KB-Verwaltung

## 5. Gruppenrechte und Integrationsauth

Ziel:
Zugriffsrechte ueber Gruppen und MCP-Integrationen steuern.

Deliverables:

- `access_groups`
- Mapping Gruppe zu Knowledge Base
- `mcp_principals`, Tokens oder Service Accounts
- Mapping Principal zu Gruppe
- effektive Rechteberechnung im MCP-Server und HTTP-Layer
- ACL-Pruefung fuer Suche, Dokumentzugriff, Download, Extraktion, Summary und Compare
- Admin-Verwaltung fuer Integrationen und Rechte

## 6. Search Index und Hybrid Retrieval Layer

Ziel:
OpenSearch oder Elasticsearch als zusaetzliche Suchschicht fuer mehrere tausend Dokumente einfuehren.

Deliverables:

- Suchindex fuer Dokumente, Sections und Chunks
- Index-Synchronisation aus PostgreSQL
- BM25, Volltext, Fuzzy Search, Highlighting, Filter und Facetten
- Hybrid Candidate Retrieval vor dem finalen Ranking
- Ranking- und Debug-Ansicht
- Query-Policy fuer lexical versus semantic versus hybrid

## 7. Antwortaufbereitung und Quellenpakete

Ziel:
Antworten und Toolergebnisse nachvollziehbar, zitierfaehig und UI-tauglich machen.

Deliverables:

- standardisierte Antwortpakete mit Dokument, Abschnitt, Seite, Evidenz und Originaldatei-Link
- Quellenkarten fuer API, Dashboard, Open WebUI und MCP
- Confidence- und Debug-Felder
- Tool-Traces fuer Transparenz und spaetere Regressionstests

## 8. Betrieb, Evaluierung und Regression

Ziel:
Retrieval-, ACL- und Antwortqualitaet messbar und regressionssicher machen.

Deliverables:

- kleines Goldenset mit echten Nutzerfragen
- erwartete Dokument- und Section-Treffer pro Frage
- Vergleich von Retrieval-Pfaden
- Retrieval-, ACL- und Tool-Routing-Regressionstests
- Evaluierung fuer Trefferqualitaet, Quellenkonsistenz und Antworttreue
- spaeter Vergleich von `semantic_only`, `hybrid`, Profilvarianten und Search-Layer-Strategien

## 9. Originaldateien und Nutzerfluss

Ziel:
Den Sprung von Trefferlisten zu direkt nutzbaren Dokumenten mit sicherem Zugriff und klarer Herkunft schaffen.

Deliverables:

- ACL-sichere Download- und Preview-Links
- Quellenkarten mit Dokument-, Abschnitts- und Seitenbezug
- klare Sichtbarkeitsregeln fuer interne und externe Dokumente
- Integritaetspruefung fuer Originaldateien

## Auswirkungen auf Datenmodell

Neue Kernobjekte:

- `knowledge_bases`
- `collections`
- `documents`
- `document_sections`
- `document_chunks`
- `source_files` oder `document_files`
- `access_groups`
- `access_group_knowledge_bases`
- `mcp_principals`
- `principal_groups`

Zusaetzliche Dokumentfelder:

- `knowledge_base_id`
- `collection_id`
- `primary_type`
- `secondary_types`
- `traits`
- `processing_profile`
- `classification_confidence`
- `classification_method`
- `classification_model`
- `classification_prompt_version`

Wichtige Datenmodellregeln:

- stabile IDs fuer Dokumente, Sections und Dateien
- klare Vererbung des KB-Kontexts auf Sections, Chunks und Dateien
- ACL-sichere Originaldatei-Zugriffe
- Versionierung fuer Processing Profiles und Klassifikationsentscheidungen

## Profilgesteuerte Chunking- und Sectioning-Strategie

Chunking und Sectioning werden als eigene, profilgesteuerte Schicht betrachtet und nicht mehr als globale Einheits-Pipeline.

Beispiele:

- Buch und Longform: hierarchisch nach Kapitel und Unterkapitel, mit Small-to-Big
- Scientific Paper: `abstract`, `methods`, `results`, `discussion`, `references`
- Meeting Minutes: TOPs, Agenda-Punkte, Beschluesse, Aufgaben
- Policy und Contract: Paragraphen, Klauseln, Ausnahmen, Gueltigkeitsbereiche
- Code Documentation: Ueberschriften, Code-Fences, Endpoints, Config-Bloecke
- Source Code: symbol- oder dateibasiert, nicht prose-basiert
- Scanned PDFs: kleinere OCR-robuste Chunks mit Page Anchors

## Priorisierte Roadmap

## Kurzfristig

Ziel:
Architekturgrundlagen fuer mehrmandantenfaehige, profilgesteuerte Dokumentnutzung legen.

Prioritaeten:

- Volltext- und Abschnitts-Tools weiter stabilisieren
- Knowledge Base als First-Class-Objekt einfuehren
- Gruppen- und Principal-Modell vorbereiten
- Dokumentklassifikation mit externem kleinen LLM einfuehren
- Processing Profiles definieren und persistieren
- einfache ACL-Pruefung im MCP- und API-Layer etablieren

## Mittelfristig

Ziel:
Profilgesteuerte Verarbeitung und robuste Antwortpakete produktiv machen.

Prioritaeten:

- profilgesteuertes Sectioning und Chunking
- dokumenttypspezifische Extraktionen ueber Processing Profiles steuern
- Antwortpakete mit Quellen, Originaldatei-Link und Debug-Feldern standardisieren
- fruehe Evaluierung und Regressionstests einfuehren
- OpenSearch oder Elasticsearch als Suchschicht integrieren
- Hybrid Retrieval plus Reranking plus Query-Policy ausbauen

## Spaeter

Ziel:
Tiefere Vergleichs-, Verlauf- und Wissensnetz-Funktionen auf stabiler Basis aufbauen.

Prioritaeten:

- feinere Vergleichs- und Cross-Reference-Logik
- Zeitachsen und Verlaufsanalyse
- Entitaetsnormalisierung und Graph-Schicht
- differenzierte Policies pro Knowledge Base
- weitergehende Explorer- und Analysefunktionen

## Konkrete Phasen

## Phase 1: Knowledge Bases, Principals und ACL-Grundlage

Deliverables:

- `knowledge_bases` und `collections`
- Dokumentzuordnung zu KB und Collection
- `mcp_principals`, `access_groups`, `principal_groups`
- serverseitige ACL-Pruefung fuer Search, Dokumentabruf und Originaldateien
- erste Admin-Funktionen fuer KB- und Integrationsverwaltung

## Phase 2: Dokumentklassifikation und Processing Profiles

Deliverables:

- heuristische Voranalyse
- externer Klassifikations-Provider
- Persistenz von Typ, Traits und Processing Profile
- Reclassify- und Backfill-Pipeline
- versionierte Processing Profiles

## Phase 3: Profilgesteuerte Ingestion

Deliverables:

- profilgesteuertes Chunking
- profilgesteuertes Sectioning
- profilgesteuerte Extraktionsauswahl
- Page Anchors und bessere Strukturmodelle
- OCR-resiliente Spezialpfade fuer gescannte Dokumente

## Phase 4: Retrieval- und Antwortpakete

Deliverables:

- Retrieval-Modi und Query-Policy
- Antwortpakete mit Evidenz, Quellenkarte und Originaldatei-Link
- ACL-sichere Tool-Pfade fuer MCP, API und Dashboard
- Debug- und Trace-Felder fuer Antwortpfade

## Phase 5: Search Layer und grosse Dokumentbestaende

Deliverables:

- OpenSearch oder Elasticsearch als optionale Suchschicht
- Index-Synchronisation aus PostgreSQL
- BM25, Highlighting, Facetten und Filter
- Hybrid Candidate Retrieval und Ranking-Debugging

## Phase 6: Evaluierung und Regression

Deliverables:

- Goldenset und Erwartungstreffer
- Retrieval-Regressionen
- ACL-Tests
- Tool-Routing-Tests
- Vergleich der Retrieval-Modi und Profilvarianten

## Phase 7: Fortgeschrittene Vergleichs- und Wissensnetz-Funktionen

Deliverables:

- Delta- und Verlaufszusammenfassungen
- Zeitachsen und Versionspfade
- Entitaetsnormalisierung
- spaeter optionale GraphRAG-Ebene

## Sinnvolle zusaetzliche Funktionen

- Query-Rewriting fuer unscharfe Fragen
- Alias- und Namensnormalisierung fuer Entitaeten
- Synonym- und Sprachvarianten-Unterstuetzung
- Tabellen- und Listen-Extraktion
- Bild- oder Diagramm-Beschreibungen aus OCR- oder Vision-Pipelines
- Modus "frag nur dieses Dokument"
- thematische Sammlungen und Cluster
- semantische Dokumentverlinkung
- automatische FAQ-Erzeugung pro Dokument
- Wiederverwendung von Zwischenartefakten wie Summary, Action-Items und Entitaeten
- alternative Blob-Speicher-Backends statt nur Dateisystem

## Empfohlene MCP-Tools mittelfristig

Kurzfristig:

- `search_rag_context`
- `list_documents`
- `get_document_context`
- `get_document_fulltext`
- `list_document_sections`
- `get_document_section`

Mittelfristig:

- `summarize_document`
- `summarize_document_section`
- `extract_meeting_actions`
- `extract_decisions`
- `extract_requirements`
- `extract_risks`
- `extract_entities`
- KB-scope-faehige Varianten der Such- und Dokumenttools

Spaeter:

- `list_entity_mentions`
- `trace_topic_over_time`
- `list_document_versions`
- `build_topic_briefing`
- `reclassify_document`

## Empfohlene Dashboard-Erweiterungen

- Knowledge-Base- und Collection-Verwaltung
- Principal- und Gruppenverwaltung
- Reclassify- und Reindex-Funktionen
- Ranking- und Query-Debug-Views
- ACL- und Integrations-Diagnose
- Dokument-Explorer mit Strukturbaum, Quellenkarten und Preview
