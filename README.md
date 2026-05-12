# RAG und RAGfind

Dokumentzentrierte RAG-Plattform mit Ingestion, hybrider Suche, MCP-Integration, Admin-Werkzeugen und einer separaten lokalen Suchoberflaeche namens `RAGfind`.

Der Stack ingestiert Uploads, synchronisierte Verzeichnisse, gecrawlte Websites und Git-Repositories, extrahiert und strukturiert deren Inhalte, speichert Embeddings und Metadaten in PostgreSQL, stellt dokumentzentrierte APIs und MCP-Tools bereit und bietet zwei sichtbare Oberflaechen:

- die Admin- und Betriebskonsole auf Port `3311`
- die Endnutzer-Suchoberflaeche `RAGfind` auf Port `3312`

## Was Das Projekt Macht

Dieses Repository ist fuer Teams gedacht, die mehr brauchen als reine Vektorsuche.

Es kombiniert:

- Ingestion fuer Uploads, lokale Verzeichnisse, Websites und Git-Repositories
- OCR-Fallback fuer gescannte oder schwer extrahierbare Dokumente
- hybride Suche ueber Vektor-, Keyword-, Fuzzy- und dokumentzentrierte Reranking-Signale
- persistierte Dokumentstruktur mit Sections und Chunk-zu-Section-Zuordnung
- Analyse-Workflows fuer Aufgaben, Entscheidungen, Fristen, Risiken, Anforderungen, Setup-Schritte, Config-Keys, API-Surfaces und Zusammenfassungen
- MCP-Zugriff ueber HTTP und stdio fuer Open WebUI und andere MCP-faehige Clients
- wissensdatenbankbewusste Admin-Steuerung und principalbasierte Zugriffsskopierung
- `RAGfind` als separate Suchoberflaeche mit lokalem Multisource-Viewer fuer HTML, Markdown, Code und Plaintext

## Aktuelle Laufzeitoberflaechen

### Admin / API / MCP

- URL: `http://localhost:3311`
- stellt Operator-UI, Ingestion-Formulare, Dokumentbrowser, Admin-Einstellungen, Dokument-APIs und den MCP-Endpunkt bereit
- Basic Auth ist fuer Admin-Oberflaeche und Admin-APIs aktiv
- Standard-Login ist `admin` / `admin`, bis es im UI geaendert wird

### RAGfind

- URL: `http://localhost:3312`
- separater Such-Container und eigene Frontend-Oberflaeche
- der Such-Scope ist im Admin-UI auf Port `3311` konfigurierbar
- gesucht wird nur in den fuer `RAGfind` freigegebenen Wissensdatenbanken
- Suchergebnisse oeffnen in einem lokalen Multisource-Viewer statt direkt auf externe Seiten zu springen

### MCP

- HTTP-Endpunkt: `http://localhost:3311/mcp`
- lokaler stdio-Einstieg: `npm run dev:mcp:stdio` oder `npm run start:mcp:stdio`

## Kernfunktionen

### Ingestion

- manuelle Uploads
- Import-Verzeichnis-Sync ueber gemounteten Ordner
- rekursives Website-Crawling mit Download-Unterstuetzung fuer Dateien
- Git-Repository-Sync mit optionalem Branch- und Subpfad-Scope
- Extraktion fuer PDF, DOCX, ODT, TXT, Markdown, HTML, JSON, YAML, SQL, JS, TS, Python, Shell-Skripte und andere Text-/Code-Formate
- OCR-Fallback mit Tesseract und Ghostscript, wenn direkte Extraktion nicht ausreicht
- SHA-256-Deduplizierung vor Chunk- und Vektorpersistenz

### Retrieval

- semantische Vektorsuche in PostgreSQL plus pgvector
- PostgreSQL-Fulltext-Suche
- Fuzzy-Matching ueber Trigram-Indexe
- Exact-Match-Booster fuer Titel, Source-Ref und Inhalt
- dokumentzentriertes Reranking und Dokumentfokus-Verfeinerung
- Small-to-Big-Kontexterweiterung um starke Treffer herum
- Inventarmodus fuer Anfragen wie "welche Dokumente gibt es"
- Suchverbesserungen fuer Repo- und Entity-lastige MCP- und Open-WebUI-Abfragen

### Dokumentzentrierter Zugriff

- Volltextabruf kompletter Dokumente
- persistierte Sections und Strukturnavigation
- Originaldatei-Metadaten und stabile Download-URLs
- Dokumentvergleich und Versionsvergleich
- Cross-Reference-Abfragen ueber mehrere Dokumente hinweg
- lokaler Viewer fuer gecrawlte Websites, Markdown, Code-Dateien und Plaintext

### Analyse

- Extraktion von Meeting-Aufgaben
- Entscheidungsextraktion
- Fristenextraktion
- Anforderungsextraktion
- Extraktion von Config-Keys
- Extraktion von Setup-Schritten
- Extraktion von API-Surfaces
- Extraktion operativer Hinweise
- Risikoextraktion
- Entitaetenextraktion
- Dokument- und Section-Zusammenfassungen

### Admin- und Multi-KB-Steuerung

- Knowledge-Base-CRUD im Admin-UI
- MCP-Principal-Verwaltung mit KB-Scope
- Admin-User-Verwaltung und Passwortwechsel-Flow
- editierbare Dokumenttyp-Einstellungen fuer Heuristik, Klassifikation und Smart Search
- konfigurierbarer Knowledge-Base-Scope fuer `RAGfind`

## Architektur

Zentrale Laufzeitkomponenten:

- `ingestor-app`: Express-API, Admin-Dashboard, Dokument-APIs, MCP ueber HTTP
- `ingestor-worker`: BullMQ-Worker fuer Hintergrund-Ingestion und Sync-Jobs
- `ragfind`: separater Express-Runtime fuer die `RAGfind`-Suche und den lokalen Viewer
- `rag-db`: PostgreSQL mit pgvector
- `redis`: BullMQ-Backend
- `elasticsearch`: optionale Hybrid-Suchsignalquelle
- externer Ollama-Endpunkt: Embeddings, Zusammenfassungen und Dokumentklassifikation

Primaerer Ingestion-Flow:

1. Text aus Uploads, Syncs, Crawls oder Git-Inhalten extrahieren
2. bei unzureichender Extraktion auf OCR zurueckfallen
3. Inhalte normalisieren und in Chunks zerlegen
4. Embeddings ueber Ollama erzeugen
5. Dokumente, Chunks, Sections, Originaldatei-Metadaten und Analyse-Artefakte in PostgreSQL persistieren
6. Retrieval ueber HTTP, Admin-UI, MCP und `RAGfind` bereitstellen

## Repository-Struktur

```text
src/
  config/          Environment-Handling
  db/              Pool, Migrationen, Startup-Migrationslauf
  mcp/             MCP-HTTP- und stdio-Einstiege
  ragfind/         separater RAGfind-Server-Einstieg
  routes/          HTTP-Endpunkte und gemeinsame Retrieval-Logik
  services/        Ingestion, Retrieval, OCR, Analyse, Sync, Crawl, Auth
  utils/           Chunking, Dateien, Hashing, Logging
  workers/         BullMQ-Worker-Runtime
migrations/        PostgreSQL-Schema- und Index-Migrationen
public/            Admin-/Operator-Frontend
public/ragfind/    RAGfind-Frontend
import-dir/        gemountetes Import-Verzeichnis fuer Sync-basierte Ingestion
scripts/           Hilfsskripte fuer Deployment-Workflows
```

## Anforderungen

- Node.js `20.11+`
- PostgreSQL mit pgvector
- Redis
- externer Ollama-Endpunkt
- Docker und Docker Compose fuer den einfachsten lokalen Betrieb
- optionale OCR-Abhaengigkeiten fuer gescannte Inhalte

## Schnellstart Mit Docker Compose

1. Environment-Vorlage kopieren.

```bash
cp .env.example .env
```

2. Mindestens diese Werte anpassen:

- `OLLAMA_BASE_URL`
- optional `DOCUMENT_CLASSIFIER_OLLAMA_BASE_URL`
- optional `PUBLIC_BASE_URL`

3. Gesamten Stack bauen und starten.

```bash
docker compose up --build
```

4. Admin-Konsole unter `http://localhost:3311` oeffnen.

5. `RAGfind` unter `http://localhost:3312` oeffnen.

Der Standard-Compose-Stack startet:

- Admin/API/MCP auf `3311`
- `RAGfind` auf `3312`
- PostgreSQL auf Host-Port `5433`
- Redis auf Host-Port `6379`
- Elasticsearch auf Host-Port `9200`

## Lokale Entwicklung

1. Abhaengigkeiten installieren.

```bash
npm install
```

2. Environment-Datei kopieren und anpassen.

```bash
cp .env.example .env
```

3. PostgreSQL, Redis, optional Elasticsearch und den Ollama-Endpunkt starten.

4. Migrationen ausfuehren.

```bash
npm run migrate
```

5. API, Worker und optional `RAGfind` in getrennten Terminals starten.

```bash
npm run dev
```

```bash
npm run dev:worker
```

```bash
npm run dev:ragfind
```

## Verfuegbare Skripte

```bash
npm run dev              # API im Watch-Modus starten
npm run dev:worker       # BullMQ-Worker im Watch-Modus starten
npm run dev:ragfind      # RAGfind-Server im Watch-Modus starten
npm run dev:mcp:stdio    # MCP-Server ueber stdio im Watch-Modus starten
npm run build            # TypeScript kompilieren
npm run start            # kompilierte API starten
npm run start:worker     # kompilierten Worker starten
npm run start:ragfind    # kompilierten RAGfind-Server starten
npm run start:mcp:stdio  # kompilierten MCP-stdio-Server starten
npm run migrate          # SQL-Migrationen ausfuehren
```

## Wichtige Environment-Variablen

Kernservices:

- `PORT`: Admin/API-Port, Standard `3311`
- `DATABASE_URL`: PostgreSQL-Connection-String
- `REDIS_URL`: Redis-Connection-String
- `PUBLIC_BASE_URL`: Basis fuer erzeugte Download-Links und externe Referenzen

LLM und Embeddings:

- `OLLAMA_BASE_URL`
- `EMBEDDING_MODEL`
- `LLM_MODEL`
- `DOCUMENT_CLASSIFIER_OLLAMA_BASE_URL`
- `DOCUMENT_CLASSIFIER_MODEL`
- `EMBEDDING_DIMENSION`

Speicherung und Ingestion:

- `IMPORT_DIR`
- `UPLOAD_DIR`
- `ORIGINAL_STORAGE_DIR`
- `GIT_REPO_CACHE_DIR`
- `GIT_REPO_MAX_FILE_BYTES`
- `CRAWL_DEFAULT_MAX_DEPTH`

Retrieval-Tuning:

- `QUERY_TOP_K`
- `QUERY_CANDIDATE_K`
- `QUERY_MAX_CHUNKS_PER_DOCUMENT`
- `QUERY_VECTOR_WEIGHT`
- `QUERY_KEYWORD_WEIGHT`
- `QUERY_EXACT_MATCH_BOOST`
- `QUERY_RERANK_TOP_N`
- `QUERY_SMALL_TO_BIG_WINDOW`

Suchschicht-Integration:

- `ELASTICSEARCH_URL`
- `ELASTICSEARCH_INDEX_PREFIX`

Die aktuellen Defaults stehen in `.env.example`.

## Dashboard und Admin-UI

Die Admin-Konsole auf Port `3311` enthaelt aktuell:

- Upload-, Crawl-, Directory-Sync- und Git-Import-Formulare
- Dokumentbrowser mit Vorschau und Dokumentaktionen
- Trigger-Oberflaechen fuer Dokumentanalysen
- Unterstuetzung fuer Dokument-Reklassifikation
- Knowledge-Base-Verwaltung
- MCP-Principal-Verwaltung
- Admin-User-Verwaltung
- Dokumenttyp-Einstellungen
- `RAGfind`-KB-Auswahl

Die Admin-Konsole ist die Stelle, an der der Such-Scope fuer `RAGfind` konfiguriert wird.

## RAGfind

`RAGfind` ist ein separater Container und ein separates Frontend fuer die Endnutzer-Dokumentsuche.

Aktuelles Verhalten:

- sucht nur in den fuer `RAGfind` aktivierten Wissensdatenbanken
- gruppiert Chunk-Treffer zu dokumentzentrierten Ergebnissen
- zieht bei Bedarf direkte Titel- und Source-Ref-Treffer als Ergaenzung nach
- oeffnet immer einen lokalen Viewer statt gecrawlte Seiten direkt auf der Live-Website aufzurufen
- bietet einen Multisource-Viewer mit gerendertem HTML, gerendertem Markdown, syntaxhervorgehobenem Code und einem Plaintext-Tab

## Open-WebUI-Integration

Open WebUI sollte nur ueber MCP angebunden werden.

Empfohlener Endpunkt:

```text
http://localhost:3311/mcp
```

Es gibt in diesem Repository keine mitverwalteten Open-WebUI-Python-Filter-, Tool- oder Action-Dateien mehr.

## MCP-Unterstuetzung

Der Service stellt MCP in zwei Modi bereit.

### Streamable HTTP MCP

Endpunkt:

```text
http://localhost:3311/mcp
```

### Lokales stdio-MCP

Entwicklung:

```bash
npm run dev:mcp:stdio
```

Produktions-Build:

```bash
npm run build
npm run start:mcp:stdio
```

### MCP-Tool-Kategorien

Verfuegbare Tools decken ab:

- Retrieval und Smart Search
- Dokumentlisten und Dokument-Lookups
- Volltext-, Section- und Strukturzugriff
- Originaldatei-Metadaten
- Dokumentanalysen und Zusammenfassungen
- Dokumentvergleiche und Cross-Reference-Workflows

## Wichtige HTTP-API-Endpunkte

### Retrieval

- `POST /api/smart-search`
- `POST /api/cross-reference`

### Dokumente

- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/fulltext`
- `GET /api/documents/:id/sections`
- `GET /api/documents/:id/structure`
- `GET /api/documents/:id/section`
- `GET /api/documents/:id/original/meta`
- `GET /api/documents/:id/original`

### Analyse

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

## Hinweise Zu Crawl und Git

- Website-Crawling folgt same-site Links und herunterladbaren Dateien
- weitergeleitete Domains wie `bmetallica.de -> www.bmetallica.de` werden ueber den Redirect-Ursprung hinweg korrekt gecrawlt
- Git-Ingestion unterstuetzt optionalen Branch- und Subpfad-Scope und indexiert gaengige Text- und Code-Formate

## GitHub-Repository-Vorbereitung

Dieses Repository ist fuer die Veroeffentlichung auf GitHub vorbereitet mit:

- einer repositorytauglichen README
- einer MIT-Lizenz
- `.gitignore` fuer Node, Build, lokale Envs und Import-Artefakte
- Anleitungen fuer containerbasierten und lokalen Betrieb
- einer klaren Trennung zwischen Admin-Oberflaeche und `RAGfind`

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe `LICENSE`.

## Roadmap und Design-Notizen

Fuer tiefere Produkt- und Retrieval-Notizen siehe:

- `ROADMAP.md`
- `rag-logik.md`

## Status

Das Repository ist weiterhin in aktiver Entwicklung, die aktuelle Implementierung enthaelt aber bereits:

- Multi-Source-Ingestion
- persistierte Struktur- und Originaldatei-Referenzen
- Analyse- und Summary-Workflows
- MCP-Integration
- wissensdatenbankbewusste Admin-Konfiguration
- separate `RAGfind`-Sucherfahrung mit lokalem Viewer
