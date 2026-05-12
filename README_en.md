# RAG and RAGfind

Document-centric RAG platform with ingestion, hybrid retrieval, MCP integration, admin tooling, and a separate local-first search UI called `RAGfind`.

The stack ingests uploads, synced folders, crawled websites, and git repositories; extracts and structures their content; stores embeddings and metadata in PostgreSQL; exposes document-centric APIs and MCP tools; and provides two operator-facing surfaces:

- the admin and operations console on port `3311`
- the end-user search interface `RAGfind` on port `3312`

## What The Project Does

This repository is built for teams that need more than raw vector search.

It combines:

- ingestion for uploads, local folders, websites, and git repositories
- OCR fallback for scanned or difficult documents
- hybrid search across vector, keyword, fuzzy, and document-aware reranking signals
- persisted document structure with sections and chunk-to-section mapping
- document analysis workflows for actions, decisions, deadlines, risks, requirements, setup steps, config keys, API surfaces, and summaries
- MCP access over HTTP and stdio for Open WebUI and other MCP-capable clients
- knowledge-base-aware admin controls and principal-based access scope
- `RAGfind`, a separate search frontend with a local multisource viewer for HTML, Markdown, code, and plaintext

## Current Runtime Surfaces

### Admin / API / MCP

- URL: `http://localhost:3311`
- provides the operator UI, ingestion forms, document browser, admin settings, document APIs, and MCP endpoint
- Basic Auth is enabled for the admin console and admin APIs
- default login is `admin` / `admin` until changed in the UI

### RAGfind

- URL: `http://localhost:3312`
- separate search container and frontend
- search scope is configurable from the admin UI on port `3311`
- search is limited to the knowledge bases selected for `RAGfind`
- search results open in a local multisource viewer instead of jumping straight to remote pages

### MCP

- HTTP endpoint: `http://localhost:3311/mcp`
- local stdio entrypoint: `npm run dev:mcp:stdio` or `npm run start:mcp:stdio`

## Key Features

### Ingestion

- manual uploads
- import directory sync via mounted folder
- recursive website crawling with file download support
- git repository sync with optional branch and subpath scoping
- extraction for PDF, DOCX, ODT, TXT, Markdown, HTML, JSON, YAML, SQL, JS, TS, Python, shell scripts, and other text/code formats
- OCR fallback using Tesseract and Ghostscript when direct extraction is insufficient
- SHA-256 deduplication before chunk/vector persistence

### Retrieval

- semantic vector search in PostgreSQL + pgvector
- PostgreSQL full-text search
- fuzzy matching via trigram indexes
- exact-match boosts for title, source reference, and content
- document-aware reranking and document-focus refinement
- small-to-big context expansion around strong hits
- inventory mode for "which documents exist?" style queries
- search improvements for repo-style and entity-style queries in MCP/Open WebUI flows

### Document-Centric Access

- full document fulltext retrieval
- persisted sections and structure navigation
- original file metadata and stable download URLs
- document comparison and version comparison
- cross-reference queries across documents
- local viewer for crawled websites, Markdown, code files, and plaintext

### Analysis

- meeting action extraction
- decision extraction
- deadline extraction
- requirement extraction
- config key extraction
- setup step extraction
- API surface extraction
- operational note extraction
- risk extraction
- entity extraction
- document and section summaries

### Admin And Multi-KB Controls

- knowledge base CRUD in the admin UI
- MCP principal management with KB scoping
- admin user management and password change flow
- editable document-type settings used by heuristics, classification, and smart search
- configurable `RAGfind` knowledge-base scope

## Architecture

Core runtime components:

- `ingestor-app`: Express API, admin dashboard, document APIs, MCP over HTTP
- `ingestor-worker`: BullMQ worker for background ingestion and sync jobs
- `ragfind`: separate Express runtime for the `RAGfind` search UI and local viewer
- `rag-db`: PostgreSQL with pgvector
- `redis`: BullMQ backend
- `elasticsearch`: optional hybrid search signal source
- external Ollama endpoint: embeddings, summaries, and document classification

Primary ingestion flow:

1. extract text from uploaded, synced, crawled, or git-based content
2. fall back to OCR when extraction is insufficient
3. normalize and chunk the content
4. generate embeddings through Ollama
5. persist documents, chunks, sections, original-file metadata, and analysis artifacts in PostgreSQL
6. expose retrieval through HTTP, admin UI, MCP, and `RAGfind`

## Repository Layout

```text
src/
  config/          environment handling
  db/              pool, migrations, startup migration runner
  mcp/             MCP HTTP and stdio entrypoints
  ragfind/         separate RAGfind server entrypoint
  routes/          HTTP endpoints and shared retrieval logic
  services/        ingestion, retrieval, OCR, analysis, sync, crawl, auth
  utils/           chunking, files, hashing, logging
  workers/         BullMQ worker runtime
migrations/        PostgreSQL schema and index migrations
public/            admin/operator frontend
public/ragfind/    RAGfind frontend
import-dir/        mounted import directory for sync-based ingestion
scripts/           helper scripts for deployment workflows
```

## Requirements

- Node.js `20.11+`
- PostgreSQL with pgvector
- Redis
- external Ollama endpoint
- Docker and Docker Compose for the simplest local deployment
- optional OCR dependencies for scanned content

## Quick Start With Docker Compose

1. Copy the environment template.

```bash
cp .env.example .env
```

2. Adjust at least these values:

- `OLLAMA_BASE_URL`
- optionally `DOCUMENT_CLASSIFIER_OLLAMA_BASE_URL`
- optionally `PUBLIC_BASE_URL`

3. Build and start the full stack.

```bash
docker compose up --build
```

4. Open the admin console at `http://localhost:3311`.

5. Open `RAGfind` at `http://localhost:3312`.

The default Compose stack starts:

- admin/API/MCP on `3311`
- `RAGfind` on `3312`
- PostgreSQL on host port `5433`
- Redis on host port `6379`
- Elasticsearch on host port `9200`

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Copy and adjust the environment file.

```bash
cp .env.example .env
```

3. Start PostgreSQL, Redis, Elasticsearch if desired, and your Ollama endpoint.

4. Run migrations.

```bash
npm run migrate
```

5. Start the API, worker, and optionally `RAGfind` in separate terminals.

```bash
npm run dev
```

```bash
npm run dev:worker
```

```bash
npm run dev:ragfind
```

## Available Scripts

```bash
npm run dev              # start API in watch mode
npm run dev:worker       # start BullMQ worker in watch mode
npm run dev:ragfind      # start RAGfind server in watch mode
npm run dev:mcp:stdio    # run MCP server over stdio in watch mode
npm run build            # compile TypeScript
npm run start            # start compiled API
npm run start:worker     # start compiled worker
npm run start:ragfind    # start compiled RAGfind server
npm run start:mcp:stdio  # start compiled MCP stdio server
npm run migrate          # run SQL migrations
```

## Important Environment Variables

Core services:

- `PORT`: admin/API port, default `3311`
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `PUBLIC_BASE_URL`: used for emitted download links and external references

LLM and embedding:

- `OLLAMA_BASE_URL`
- `EMBEDDING_MODEL`
- `LLM_MODEL`
- `DOCUMENT_CLASSIFIER_OLLAMA_BASE_URL`
- `DOCUMENT_CLASSIFIER_MODEL`
- `EMBEDDING_DIMENSION`

Storage and ingestion:

- `IMPORT_DIR`
- `UPLOAD_DIR`
- `ORIGINAL_STORAGE_DIR`
- `GIT_REPO_CACHE_DIR`
- `GIT_REPO_MAX_FILE_BYTES`
- `CRAWL_DEFAULT_MAX_DEPTH`

Retrieval tuning:

- `QUERY_TOP_K`
- `QUERY_CANDIDATE_K`
- `QUERY_MAX_CHUNKS_PER_DOCUMENT`
- `QUERY_VECTOR_WEIGHT`
- `QUERY_KEYWORD_WEIGHT`
- `QUERY_EXACT_MATCH_BOOST`
- `QUERY_RERANK_TOP_N`
- `QUERY_SMALL_TO_BIG_WINDOW`

Search-layer integration:

- `ELASTICSEARCH_URL`
- `ELASTICSEARCH_INDEX_PREFIX`

See `.env.example` for the current defaults.

## Dashboard And Admin UI

The admin console on port `3311` currently includes:

- upload, crawl, directory sync, and git import forms
- document browser with preview and per-document actions
- document analysis trigger surfaces
- document reclassification support
- knowledge base management
- MCP principal management
- admin user management
- document-type settings
- `RAGfind` KB selection

The admin console is the place where `RAGfind` search scope is configured.

## RAGfind

`RAGfind` is a separate container and frontend intended for end-user document search.

Current behavior:

- searches only in the knowledge bases enabled for `RAGfind`
- groups chunk hits into document-level results
- supplements grouped search results with direct title/source-reference matches when needed
- always opens a local viewer instead of redirecting crawled pages to the live website
- provides a multisource viewer with rendered HTML, rendered Markdown, syntax-highlighted code, and a plaintext tab

## Open WebUI Integration

Open WebUI should connect through MCP only.

Recommended endpoint:

```text
http://localhost:3311/mcp
```

There are no repository-managed Open WebUI Python filter, tool, or action files in this repository anymore.

## MCP Support

The service exposes MCP in two modes.

### Streamable HTTP MCP

Endpoint:

```text
http://localhost:3311/mcp
```

### Local stdio MCP

Development:

```bash
npm run dev:mcp:stdio
```

Production build:

```bash
npm run build
npm run start:mcp:stdio
```

### MCP Tool Categories

Available tools cover:

- retrieval and smart search
- document listing and lookup
- fulltext, sections, and structure access
- original file access metadata
- document analysis and summaries
- document comparison and cross-reference workflows

## HTTP API Highlights

### Retrieval

- `POST /api/smart-search`
- `POST /api/cross-reference`

### Documents

- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/fulltext`
- `GET /api/documents/:id/sections`
- `GET /api/documents/:id/structure`
- `GET /api/documents/:id/section`
- `GET /api/documents/:id/original/meta`
- `GET /api/documents/:id/original`

### Analysis

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

## Crawl And Git Notes

- website crawling follows same-site links and downloadable files
- redirected domains such as `bmetallica.de -> www.bmetallica.de` are crawled correctly across the redirected origin
- git ingestion supports optional branch and subpath selection and indexes common text/code formats

## GitHub Repository Preparation

This repository is prepared to be published on GitHub with:

- a repository-focused README
- an MIT license
- `.gitignore` for Node, build, local env, and import artifacts
- container-based and local development instructions
- explicit separation between admin surface and `RAGfind`

## License

This project is licensed under the MIT License. See `LICENSE`.

## Roadmap And Design Notes

For deeper product direction and retrieval design notes, see:

- `ROADMAP.md`
- `rag-logik.md`

## Status

This is an actively evolving repository, but the current implementation already includes:

- multi-source ingestion
- persisted structure and original file references
- analysis and summary workflows
- MCP integration
- knowledge-base-aware admin configuration
- separate `RAGfind` search experience with local viewer