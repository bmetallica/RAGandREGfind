# RAG-Logik

## Zielbild

Das System ist inzwischen kein reiner Chunk-Retriever mehr, sondern ein dokumentzentriertes RAG- und Analyse-System. Der Fokus liegt darauf, Wissen aus sehr unterschiedlichen Quellen wie Protokollen, Handbuechern, Buechern, Richtlinien, Web-Crawls und Uploads belastbar nutzbar zu machen.

Die Zielrichtung ist eine dokumentzentrierte, mehrmandantenfaehige RAG-Plattform mit:

- PostgreSQL plus pgvector als Source of Truth
- optionalem OpenSearch- oder Elasticsearch-Layer fuer Volltext, BM25, Fuzzy und Hybrid Candidate Retrieval
- einem zentralen MCP- und API-Layer als Orchestrator fuer Authentifizierung, Rechte, Query-Routing und Toolwahl
- Open WebUI als Tool-Consumer und UI, nicht als primaere Fachlogik
- einem kleinen externen LLM fuer Dokumentklassifikation und Profilwahl beim Ingest oder Reclassify-Lauf

Wichtige Leitentscheidungen:

- Dokumente zuerst
- Struktur vor Semantik
- Retrieval ist nicht Nutzung
- ACL vor Retrieval
- Antworten muessen auf Dokument, Abschnitt, Seite und Originalquelle rueckfuehrbar sein

## Architekturueberblick

### 0. Zielarchitektur und Rollentrennung

Die Zielarchitektur trennt bewusst zwischen Wahrheit, Suchschicht, Orchestrierung und UI:

- PostgreSQL plus pgvector verwaltet Dokumente, Sections, Chunks, Embeddings, Metadaten, Extraktionen, Summaries, Versionen, Originaldateien und kuenftig ACL-Kontext.
- OpenSearch oder Elasticsearch ist eine optionale zweite Suchschicht fuer BM25, Highlighting, Facetten, Filter und Hybrid Retrieval bei groesseren Bestaenden.
- MCP und HTTP-API bleiben der zentrale Orchestrator fuer Authentifizierung, Rechtepruefung, Intent-Erkennung, Query-Policy und Toolauswahl.
- Open WebUI nutzt diese Funktionen, ist aber nicht der Ort fuer Rechte- oder Retrieval-Wahrheit.
- Ein externer Klassifikations-Provider liefert Dokumenttyp, Traits und Processing Profile. Dieses Modell laeuft ausdruecklich nicht lokal auf derselben Maschine wie das Kernsystem.

### 1. Ingestion

Quellen:

- manuelle Uploads
- synchronisiertes Import-Verzeichnis
- Web-Crawls
- Git-Repositories mit optionalem Branch- und Subpfad-Scope
- OCR-Fallback fuer schlecht lesbare Dokumente
- Redirect-resiliente Crawls, damit Domains wie `bmetallica.de` nach `www.bmetallica.de` weiter traversiert werden koennen

Verarbeitung:

- Textextraktion aus PDF, DOCX, ODT und TXT
- Textextraktion aus text- und codeartigen Repository-Dateien
- OCR-Fallback ueber Tesseract/Ghostscript
- Normalisierung des Texts
- Deduplizierung ueber SHA-256 Content-Hash
- kuenftig profilgesteuertes Chunking mit Offsets
- Embedding-Erzeugung ueber externe Ollama-Instanz
- Speicherung in PostgreSQL mit pgvector

Geplante Erweiterung:

- heuristische Voranalyse ueber MIME, Dateiname, Quelle und Strukturmarker
- externer Klassifikationsaufruf ueber konfigurierbaren Endpoint
- Persistenz von `documentType`, Klassifikationsdetails und spaeter `primary_type`, `secondary_types`, `traits`, `processing_profile` und Klassifikations-Confidence
- Reclassify- und Backfill-Pipeline fuer Bestandsdokumente
- zentrale, im WebUI bearbeitbare Dokumenttyp-Registry fuer Prompt-Hints, Kategorien, Prioritaeten und Heuristik-Signale

Relevante Stellen:

- `src/services/ingestionService.ts`
- `src/services/extractorService.ts`
- `src/services/ocrService.ts`
- `src/services/crawlService.ts`
- `src/utils/chunking.ts`
- `src/services/vectorService.ts`

### 2. Speicherung

Zentrale Tabellen:

- `knowledge_bases`: kuenftige Wissensraeume als First-Class-Objekte
- `collections`: Untergliederungen innerhalb einer Knowledge Base
- `documents`: Volltext, Quelle, Metadaten, Content-Hash
- `document_chunks`: Vektor-Chunks mit Offsets und Metadaten
- `document_sections`: persistierte Dokumentstruktur
- `document_artifacts`: gecachte Analyse- und Summary-Ergebnisse
- `document_files`: persistierte Originaldatei-Referenzen und Download-Metadaten
- `access_groups`, `access_group_knowledge_bases`, `mcp_principals`, `principal_groups`: kuenftige ACL- und Integrationsobjekte
- `scheduled_jobs`: Scheduler-Konfiguration

Zusaetzliche Zielattribute auf Dokumentebene:

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

Aktuell bereits produktiv in `metadata` genutzt:

- `documentType`
- `classification.confidence`
- `classification.summary`
- `classification.rationale`
- `classification.traits`
- `classification.model`
- `classification.classifiedAt`

Migrationen:

- `migrations/001_init.sql`
- `migrations/002_hybrid_search_indexes.sql`
- `migrations/003_fuzzy_search_indexes.sql`
- `migrations/004_document_sections.sql`
- `migrations/005_document_artifacts.sql`
- `migrations/006_document_files.sql`

## Retrieval-Logik

### 1. Hybrid Retrieval

Die zentrale Retrieval-Logik kombiniert:

- semantische Vektorsuche
- PostgreSQL Fulltext-Suche
- Fuzzy-Matching ueber `pg_trgm`
- Exact-Match-Boost fuer Titel, Dateiname und Chunk-Inhalt
- Dokument-zentriertes Re-Ranking
- zweite heuristische Rerank-Stufe ueber die besten Kandidaten
- Bevorzugung lokaler Upload- und Sync-Dokumente gegen Crawl-Rauschen
- Small-to-Big Retrieval: starke Treffer werden auf Abschnitts- oder Chunk-Window-Kontext vergroessert

Zielerweiterung:

- Query-Policy fuer `semantic_only`, `lexical_only`, `hybrid`, `document_first` und `section_first`
- optionaler Candidate-Layer ueber OpenSearch oder Elasticsearch
- profilgesteuerte Gewichtung fuer Chunking, Sectioning, Extraktion und Retrieval
- ACL-Scope wird vor Candidate Retrieval bestimmt

Damit liegt das System bereits in Richtung des gaengigen Hybrid-Search-Ansatzes vieler produktiver RAG-Systeme. Noch nicht umgesetzt sind ein separates Cross-Encoder-Reranking und eine noch staerkere metadatengetriebene Query-Umschreibung.

Zusaetzlich gibt es einen Inventar-Modus fuer generische Fragen wie "welche dokumente gibt es". Solche Fragen umgehen die normale Chunk-Suche und liefern stattdessen eine lokal priorisierte Dokumentliste.

Fuer `RAGfind` wurde die Ergebnislogik zuletzt erweitert:

- intern werden mehr Chunk-Kandidaten geholt als spaeter als Dokumente angezeigt werden
- die Begrenzung passiert erst nach der Dokumentgruppierung
- wenn zu wenige Dokumente gefunden werden, werden direkte Titel- und Source-Ref-Treffer als lokaler Fallback nachgezogen

Relevante Stelle:

- `src/routes/api.ts`
- `src/ragfind/server.ts`

### 2. Dokumentzentrierte Navigation

Neben der Such-API gibt es jetzt dokumentzentrierte Zugriffe:

- Volltext eines Dokuments
- persistierte Abschnitte
- Strukturbaum eines Dokuments
- einzelner Abschnitt per Index oder Query
- Smart Search mit Kategorie- und Dokumenttypfiltern
- Listen- und Query-Filter im WebUI aus derselben zentralen Dokumenttyp-Registry
- Originaldatei-Metadaten und stabiler Download-Link
- Chunks sind einem Abschnitt zugeordnet
- separates Suchfrontend `RAGfind` fuer dokumentzentrierte Ergebnisnavigation
- lokaler Multisource-Viewer fuer HTML, Markdown, Code und Plaintext statt direkter Live-Weiterleitung auf gecrawlte Seiten

Zielerweiterung:

- Knowledge-Base- und Collection-Scope in allen Such- und Dokumenttools
- Antwortpakete mit Evidenz, Seitenbereich, Originaldatei-Link und optionalem Tool-Trace
- klare Trennung zwischen Search, Section-Navigation, Compare, Extract und Summarize-Flows

Das ist bereits eine wichtige Basis fuer spaetere Tools wie `get_document_structure`, `smart_search` und dokumenttypspezifische Navigationspfade.

Relevante Stellen:

- `src/services/documentService.ts`
- `src/routes/api.ts`
- `src/mcp/server.ts`
- `src/ragfind/server.ts`

## Dokumentstruktur

### 1. Persistierte Abschnitte

Beim Ingest und beim Startup-Backfill wird aus dem Volltext eine Dokumentstruktur abgeleitet.

Erkannt werden derzeit heuristisch:

- Kapitel
- Teile und Abschnitte
- Agenda-Punkte und Tagesordnungspunkte
- Anhaenge
- grobe Seitenmarker
- typische Meeting-/Aufgaben-Indikatoren

Diese Struktur wird in `document_sections` persistiert. Bereits vorhandene Dokumente werden automatisch nachgezogen, wenn noch keine Struktur existiert oder die Strukturversion veraltet ist.

Zielerweiterung:

- Sectioning wird kuenftig processing-profile-gesteuert statt global heuristisch.
- Beispiele: `book_hierarchical`, `paper_structured`, `meeting_structured`, `policy_legal`, `code_structured`, `ocr_resilient`.
- fuer gescannte Dokumente werden OCR-robuste Chunks mit Page Anchors wichtig.

### 2. Chunk-Verknuepfung

Jeder Chunk bekommt:

- `start_offset`
- `end_offset`
- `document_section_id`
- Abschnittsmetadaten in `metadata`

Dadurch koennen Suchtreffer spaeter stabil einem Kapitel, Abschnitt oder Agenda-Punkt zugeordnet werden.

## Originaldateien und Quellenlinking

Originalquellen werden jetzt nicht mehr nur implizit ueber `metadata.filePath` oder externe URLs gehalten, sondern in `document_files` persistiert.

Der Pfad ist dabei bewusst getrennt:

- Such- und Strukturdaten bleiben in `documents`, `document_chunks` und `document_sections`
- Originaldateien werden lokal im Original-Storage abgelegt oder als externe URL referenziert
- API, Dashboard und MCP erhalten daraus stabile Download-Links

Fuer Bestandsdokumente laeuft ein Backfill beim Start. Dabei werden vorhandene Uploads, Sync-Dateien und verfuegbare lokale Quelldateien in den verwalteten Originalspeicher kopiert. Crawl-Quellen ohne lokale Datei bleiben als externe Referenz verlinkt.

Zielerweiterung:

- Download- und Preview-Zugriffe werden kuenftig ACL-sicher ueber Knowledge Base und Principal-Kontext geprueft.
- Antwortpakete sollen Originaldatei-Link und Preview-Link als Standard enthalten.

## Dokumentklassifikation und Processing Profiles

Die naechste groessere Ausbaustufe ist eine explizite Klassifikations- und Profilschicht.

Der erste produktive Teil davon ist bereits umgesetzt:

- zentrale Dokumenttyp-Registry in der Datenbank
- editierbar im Admin-Modal des WebUI
- genutzt von Heuristik, LLM-Klassifizierung und Such-/Listenfiltern
- erweiterte Typen fuer technische, operative, rechtliche, finanzielle und codebezogene Dokumente

Ziel:

- Dokumente automatisch klassifizieren
- Traits und Processing Profiles persistieren
- Chunking, Sectioning, Extraktion und spaeter Retrieval profilgesteuert fahren

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

Beispielhafte Primary Types:

- `generic_text`
- `web_article`
- `documentation_website`
- `book`
- `scientific_paper`
- `technical_report`
- `meeting_minutes`
- `policy`
- `contract`
- `code_documentation`
- `source_code_file`
- `api_reference`
- `runbook_or_ops_doc`
- `requirement_spec`
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
- `is_versioned`

Beispielhafte Processing Profiles:

- `generic_text`
- `web_structured`
- `book_hierarchical`
- `paper_structured`
- `meeting_structured`
- `policy_legal`
- `code_structured`
- `source_code_symbolic`
- `table_structured`
- `ocr_resilient`

## Analyse-Logik

### 1. Protokoll- und Aufgabenextraktion

Serverseitig implementiert sind jetzt:

- `extract_meeting_actions`
- `extract_decisions`
- `extract_deadlines`
- `extract_requirements`
- `extract_config_keys`
- `extract_setup_steps`
- `extract_api_surface`
- `extract_operational_notes`
- `extract_risks`
- `extract_entities`

Die Extraktion arbeitet auf den gespeicherten Abschnitten und erkennt unter anderem:

- offene Punkte
- Aufgaben und Action Items
- Verantwortliche
- Fristen und Datumsangaben
- Beschluesse und Entscheidungen
- Voraussetzungen, Setup-Bedingungen und Konfigurationshinweise
- Konfigurationsschluessel, ENV-Variablen und CLI-Flags
- Installations-, Setup- und Run-Schritte fuer technische Dokumentationen
- API-Endpunkte, HTTP-Methoden, Statuscodes und Request-/Response-Hinweise
- Betriebs-, Troubleshooting- und Warnhinweise fuer den operativen Einsatz
- Risiken, Blocker und Warnsignale
- typische Entitaeten wie Personen, Organisationen, Daten, E-Mail-Adressen, Telefonnummern und URLs

Die Ergebnisse werden als Artefakte gecacht, damit Wiederholungsanfragen nicht immer wieder die gleiche Analyse rechnen muessen.

Relevante Stelle:

- `src/services/analysisService.ts`

### 2. Summary-Pipeline

Serverseitig implementiert sind jetzt:

- `summarize_document`
- `summarize_document_section`

Die Summary-Logik arbeitet mehrstufig:

1. Dokument oder Abschnitt bestimmen
2. bei langen Inhalten in groessere Summary-Chunks zerlegen
3. pro Chunk extraktive Verdichtung erzeugen
4. wenn moeglich LLM-basierte Endzusammenfassung ueber Ollama erzeugen
5. bei LLM-Fehler auf extraktive Zusammenfassung zurueckfallen

Das ist bewusst robust gebaut: Die Funktion bleibt nutzbar, auch wenn das externe LLM nicht verfuegbar ist.

Relevante Stellen:

- `src/services/analysisService.ts`
- `src/services/llmService.ts`

### 3. Vergleich und Cross-Reference

Serverseitig implementiert sind jetzt zusaetzlich:

- `compare_documents`
- `compare_document_versions`
- `cross_reference`

Die Vergleichslogik arbeitet aktuell heuristisch und dokumentzentriert:

- Themen werden ueber normalisierte Schluesselbegriffe aus dem Dokumenttext gegeneinander gestellt
- erkannte Action-Items werden auf gemeinsame und unterschiedliche Punkte verglichen
- fuer Versionsvergleiche kann explizit ein Vergleichsdokument angegeben oder heuristisch eine fruehere Version gesucht werden
- Cross-Reference durchsucht persistierte Dokumentabschnitte nach thematischen Treffern ueber Dokumentgrenzen hinweg

Das ist bewusst eine erste produktive Stufe. Noch nicht umgesetzt sind echte Delta-Modelle, Entitaetsgraphen oder semantisch tiefere Mehrhop-Beziehungen.

## API-Flaechen

Die API-Flaechen bleiben der zentrale Orchestrierungspfad. Kuenftig kommt dazu:

- Principal-Authentifizierung
- effektive KB- und Gruppenrechteberechnung
- ACL-Pruefung vor Search, Fulltext, Section, Summary, Compare, Extract und Originaldatei-Download
- Query-Routing ueber Intent, Dokumenttyp und Processing Profile

### HTTP-API

Wichtige Endpunkte:

- `POST /api/smart-search`
- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/fulltext`
- `GET /api/documents/:id/sections`
- `GET /api/documents/:id/structure`
- `GET /api/documents/:id/section`
- `GET /api/documents/:id/original/meta`
- `GET /api/documents/:id/original`
- `GET /api/documents/:id/analysis/actions`
- `GET /api/documents/:id/analysis/decisions`
- `GET /api/documents/:id/analysis/deadlines`
- `GET /api/documents/:id/analysis/requirements`
- `GET /api/documents/:id/analysis/config-keys`
- `GET /api/documents/:id/analysis/setup-steps`
- `GET /api/documents/:id/analysis/api-surface`
- `GET /api/documents/:id/analysis/operational-notes`
- `GET /api/documents/:id/analysis/risks`
- `GET /api/documents/:id/analysis/entities`
- `GET /api/documents/:id/summary`
- `GET /api/documents/:id/section-summary`
- `GET /api/documents/:id/compare`
- `GET /api/documents/:id/compare-version`
- `POST /api/cross-reference`

### MCP-Toolserver

Verfuegbar unter `/mcp`.

Zielerweiterung:

- principal- und gruppenbasierte Authentifizierung
- Rechtepruefung fuer alle Tools
- KB-scope-faehige Such- und Dokumenttools
- spaetere Reclassify- und Diagnose-Tools

Aktuelle Tools:

- `search_rag_context`
- `smart_search`
- `list_documents`
- `get_document_context`
- `get_document_fulltext`
- `list_document_sections`
- `get_document_structure`
- `get_document_section`
- `get_original_document`
- `get_document_download_link`
- `extract_meeting_actions`
- `extract_decisions`
- `extract_deadlines`
- `extract_requirements`
- `extract_config_keys`
- `extract_setup_steps`
- `extract_risks`
- `extract_entities`
- `summarize_document`
- `summarize_document_section`
- `compare_documents`
- `compare_document_versions`
- `cross_reference`

### Open WebUI

Open WebUI ist nur noch MCP-Client. Repository-eigene Python-Integrationen gibt es nicht mehr.

## Weiterer sinnvoller Ausbau fuer Code-Dokumentationen

Fuer README-Dateien, API-Dokus, Runbooks, ADRs und aehnliche Repo-Dokumente ist reines Chunk-Retrieval meist zu flach. Sinnvoller ist eine code-nahe Aufbereitung:

- Dokumenttyp `code_doc` mit Untertypen wie `readme`, `api_doc`, `runbook`, `adr`, `changelog`
- Abschnittserkennung an Ueberschriften, Tabellen, Code-Fences, Beispiel-Requests und Konfigurationslisten
- Extraktion von `endpoint`, `http_method`, `config_key`, `env_var`, `cli_command`, `module`, `package`, `version`
- Verknuepfung zwischen Dokuabschnitt und realen Repo-Dateien, Routen, Services oder Konfigurationsquellen
- getrennte Behandlung von erklaerendem Text und Codebeispielen, damit Antworten zunaechst die Erklaerung liefern und bei Bedarf das passende Snippet nachziehen

Damit werden Fragen wie "welche ENV-Variable steuert X", "wie starte ich den Worker", "welcher Endpoint liefert Y" oder "welcher Migrationsschritt ist fuer Z noetig" deutlich belastbarer beantwortbar als mit reinem Volltext-RAG.

## Dashboard

Das Dashboard auf Port 3311 deckt aktuell ab:

- Status und Konfiguration
- Jobs und Schedules
- Dokumentliste
- Volltext- und Abschnitts-Preview
- Strukturbaum-Preview
- Originaldokument-Download
- Query-Debug-Ausgabe

Relevante Stellen:

- `public/index.html`
- `public/app.js`

## Qualitaetsmechanismen

Bereits umgesetzt:

- explizite Fehler bei nicht erreichbarer Ollama-Instanz
- Deduplizierung per Content-Hash
- Build-Validierung ueber `npm run build`
- strukturierter Backfill fuer Altbestaende
- Artefakt-Caching fuer Summary- und Analyse-Ergebnisse
- Hybrid-Retrieval statt reinem Vektor-Ranking
- Smart Search mit Kategorie- und Dokumenttypfiltern
- heuristische zweite Rerank-Stufe und Small-to-Big Kontextausweitung
- persistierte Originaldatei-Referenzen mit stabilem Download-Link

Noch sinnvoll fuer die naechsten Phasen:

- Goldenset fuer Retrieval-Regressionsfragen
- separates Reranking fuer die besten Kandidaten nach der ersten Suche
- Small-to-Big Retrieval fuer bessere Antwortkontexte bei langen Dokumenten
- echte Kapitel-/Seitenerkennung fuer komplexe PDFs
- dokumenttypspezifische Extraktion fuer Dokus, Verträge und Richtlinien
- Vergleichsfunktionen ueber Zeit und Versionen
- dokumenttypspezifische Metadatenprofile fuer Paper, Code-Doku, Protokolle und Webquellen
- Cross-Reference und spaeter optional eine Graph-Ebene fuer Mehrhop-Fragen
- systematische Observability fuer Ranking- und Toolpfade

## Abgleich mit bewaehrten RAG-Mustern

Aus der Praxis anderer RAG-Systeme sind fuer dieses Repo besonders sinnvoll:

- Hybrid Search: bereits umgesetzt
- agentische Toolnutzung ueber MCP: bereits umgesetzt
- Reranking: sinnvoll als naechste Retrieval-Ausbaustufe
- Small-to-Big Retrieval: sinnvoll fuer grosse Protokolle, Buecher und Dokumentationen
- dokumenttypspezifische Metadatenprofile: sinnvoll fuer Filter, Ranking und bessere Toolwahl
- `smart_search`, `get_document_structure`, `cross_reference`: sinnvoll als naechste MCP-Tools
- GraphRAG: spaeter interessant, aber erst nach stabiler Metadaten- und Entitaetsbasis

Die wichtigste Priorisierung daraus ist: erst Ranking, Metadaten und Kontextgroesse sauber machen, dann graphbasierte Mehrhop-Logik. Fuer den aktuellen Reifegrad des Systems bringt GraphRAG noch weniger als gute Metadaten, saubere Struktur und ein zusaetzliches Reranking.

## Was bisher konkret umgesetzt wurde

1. Ingestion, OCR, Deduplizierung, Queueing und Scheduler
2. PostgreSQL/pgvector mit Hybrid-Retrieval und Fuzzy-Matching
3. Query-API und Dashboard
4. MCP-Toolserver mit Such- und Dokumenttools
5. persistierte Dokumentstruktur mit Backfill fuer bestehende Daten
6. Protokoll-Extraktion fuer Aufgaben, Entscheidungen und Fristen
7. serverseitige Dokument- und Abschnittszusammenfassungen
8. Artefakt-Cache fuer wiederverwendbare Analyseergebnisse
9. Smart Search, Strukturbaum und Originaldokument-Abruf ueber REST, Dashboard und MCP

## Praktische Nutzung

### Wenn die Frage allgemein ist

Beispiel: "Welche Dokumente gibt es zu Projekt X?"

Verwende:

- `list_documents`
- oder Smart Search / Dokumentliste ueber Dashboard oder API

### Wenn ein bestimmtes Dokument gemeint ist

Beispiel: "Fass das erste Kapitel zusammen"

Verwende:

- `get_document_fulltext`
- `list_document_sections`
- `get_document_section`
- `summarize_document_section`

### Wenn es um Protokolle geht

Beispiel: "Welche offenen Punkte gab es?"

Verwende:

- `extract_meeting_actions`
- `extract_decisions`
- `extract_deadlines`

### Wenn das Dokument sehr lang ist

Beispiel: Buch, lange Dokumentation, umfangreicher Bericht

Verwende:

- `summarize_document`
- optional kombiniert mit Abschnittsauswahl ueber `list_document_sections`

## Naechste sinnvolle Schritte

1. Dokumenttypspezifische Extraktion fuer technische Dokus, Richtlinien und Vertrage
2. bessere Kapitel-, Seiten- und Tabellenstruktur beim Ingest
3. Vergleichsfunktionen zwischen Dokumenten oder Versionen
4. Evaluierungs- und Regressionstest-Schicht fuer Retrieval und Antworten
