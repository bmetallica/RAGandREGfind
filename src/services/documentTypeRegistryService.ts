import { pool } from "../db/pool";

export type DocumentSearchProfile = "generic" | "narrative" | "structured" | "reference" | "record" | "code";

export interface DocumentTypeSearchSettings {
  searchProfile: DocumentSearchProfile;
  preferContentMatches: boolean;
  preferDocumentFocus: boolean;
  requireFocusTerms: boolean;
  preferAdjacentSections: boolean;
  adjacentSectionWindow: number;
  smallToBigWindow: number;
}

export interface DocumentTypeSetting {
  key: string;
  label: string;
  description: string;
  category: string;
  promptHint: string;
  keywords: string[];
  sourceTypeHints: string[];
  fileTypeHints: string[];
  enabled: boolean;
  priority: number;
  searchSettings: DocumentTypeSearchSettings;
}

interface DocumentTypeSettingRow {
  key: string;
  label: string;
  description: string;
  category: string;
  prompt_hint: string;
  keywords: unknown;
  source_type_hints: unknown;
  file_type_hints: unknown;
  enabled: boolean;
  priority: number;
  search_profile: string;
  prefer_content_matches: boolean;
  prefer_document_focus: boolean;
  require_focus_terms: boolean;
  prefer_adjacent_sections: boolean;
  adjacent_section_window: number;
  small_to_big_window: number;
}

function createSearchSettings(overrides: Partial<DocumentTypeSearchSettings> = {}): DocumentTypeSearchSettings {
  return {
    searchProfile: overrides.searchProfile ?? "generic",
    preferContentMatches: overrides.preferContentMatches ?? false,
    preferDocumentFocus: overrides.preferDocumentFocus ?? false,
    requireFocusTerms: overrides.requireFocusTerms ?? false,
    preferAdjacentSections: overrides.preferAdjacentSections ?? false,
    adjacentSectionWindow: overrides.adjacentSectionWindow ?? 1,
    smallToBigWindow: overrides.smallToBigWindow ?? 1
  };
}

const DEFAULT_DOCUMENT_TYPE_SETTINGS: DocumentTypeSetting[] = [
  {
    key: "protocol",
    label: "Protokoll",
    description: "Meeting-Protokolle, Agenda- und Beschlussdokumente.",
    category: "operations",
    promptHint: "Use for meeting minutes, agendas, board protocols, and decision logs.",
    keywords: ["protokoll", "meeting minutes", "minutes", "agenda", "tagesordnung", "beschluss"],
    sourceTypeHints: [],
    fileTypeHints: [],
    enabled: true,
    priority: 10,
    searchSettings: createSearchSettings({
      searchProfile: "structured",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "paper",
    label: "Paper",
    description: "Wissenschaftliche Arbeiten, Studien und Research-Dokumente.",
    category: "research",
    promptHint: "Use for academic papers, research studies, whitepapers, and publications.",
    keywords: ["doi", "journal", "abstract", "arxiv", "research", "paper", "study", "whitepaper"],
    sourceTypeHints: [],
    fileTypeHints: [],
    enabled: true,
    priority: 20,
    searchSettings: createSearchSettings({
      searchProfile: "reference",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "api_reference",
    label: "API-Referenz",
    description: "API-Spezifikationen, Endpunktreferenzen und Schema-Dokumente.",
    category: "technical",
    promptHint: "Use for API references, OpenAPI specs, endpoint catalogs, and schema documents.",
    keywords: ["openapi", "swagger", "endpoint", "api reference", "schema", "request", "response"],
    sourceTypeHints: [],
    fileTypeHints: ["json", "yaml", "yml"],
    enabled: true,
    priority: 25,
    searchSettings: createSearchSettings({
      searchProfile: "code",
      preferContentMatches: false,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: false,
      adjacentSectionWindow: 0,
      smallToBigWindow: 0
    })
  },
  {
    key: "documentation",
    label: "Dokumentation",
    description: "READMEs, Architektur- und technische Dokumentation.",
    category: "technical",
    promptHint: "Use for README files, architecture docs, technical documentation, and general guides.",
    keywords: ["readme", "documentation", "guide", "setup", "install", "konfiguration", "architecture"],
    sourceTypeHints: [],
    fileTypeHints: ["md", "rst", "adoc"],
    enabled: true,
    priority: 30,
    searchSettings: createSearchSettings({
      searchProfile: "structured",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "manual",
    label: "Handbuch",
    description: "Bedienungsanleitungen, Handbuecher und User Guides.",
    category: "knowledge",
    promptHint: "Use for manuals, handbooks, and user guides focused on usage instructions.",
    keywords: ["manual", "handbuch", "user guide", "bedienungsanleitung", "tutorial"],
    sourceTypeHints: [],
    fileTypeHints: ["pdf"],
    enabled: true,
    priority: 35,
    searchSettings: createSearchSettings({
      searchProfile: "reference",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "runbook",
    label: "Runbook",
    description: "Betriebs-, Incident- und Deploy-Anleitungen.",
    category: "operations",
    promptHint: "Use for operational runbooks, incident guides, rollout instructions, and playbooks.",
    keywords: ["runbook", "playbook", "incident", "deployment", "rollback", "betrieb"],
    sourceTypeHints: [],
    fileTypeHints: ["md", "txt"],
    enabled: true,
    priority: 40,
    searchSettings: createSearchSettings({
      searchProfile: "structured",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "policy",
    label: "Richtlinie",
    description: "Policies, Compliance- und Governance-Dokumente.",
    category: "governance",
    promptHint: "Use for policies, compliance guidance, governance documents, and internal rules.",
    keywords: ["policy", "richtlinie", "compliance", "governance", "security policy", "standard"],
    sourceTypeHints: [],
    fileTypeHints: [],
    enabled: true,
    priority: 50,
    searchSettings: createSearchSettings({
      searchProfile: "record",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "contract",
    label: "Vertrag",
    description: "Vertraege, SLAs, NDAs und Vereinbarungen.",
    category: "legal",
    promptHint: "Use for contracts, agreements, statements of work, SLAs, and legal commitments.",
    keywords: ["contract", "agreement", "vertrag", "sla", "statement of work", "nda", "terms"],
    sourceTypeHints: [],
    fileTypeHints: ["pdf", "docx"],
    enabled: true,
    priority: 60,
    searchSettings: createSearchSettings({
      searchProfile: "record",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "invoice",
    label: "Rechnung",
    description: "Rechnungen und abrechnungsnahe Dokumente.",
    category: "finance",
    promptHint: "Use for invoices, bills, and payment-related business documents.",
    keywords: ["invoice", "rechnung", "betrag", "subtotal", "mwst", "iban", "payment due"],
    sourceTypeHints: [],
    fileTypeHints: ["pdf"],
    enabled: true,
    priority: 70,
    searchSettings: createSearchSettings({
      searchProfile: "record",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      smallToBigWindow: 0
    })
  },
  {
    key: "ticket",
    label: "Ticket",
    description: "Issues, Support-Tickets und Task-Beschreibungen.",
    category: "operations",
    promptHint: "Use for issue tickets, support incidents, backlog items, and task descriptions.",
    keywords: ["ticket", "issue", "incident", "story", "acceptance criteria", "bug", "jira"],
    sourceTypeHints: [],
    fileTypeHints: ["md", "txt", "json"],
    enabled: true,
    priority: 75,
    searchSettings: createSearchSettings({
      searchProfile: "structured",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "email",
    label: "E-Mail",
    description: "Mailverlaeufe und nachrichtenaehnliche Dokumente.",
    category: "communication",
    promptHint: "Use for emails, message exports, and correspondence records.",
    keywords: ["subject:", "from:", "to:", "gesendet:", "betreff:", "reply-to"],
    sourceTypeHints: [],
    fileTypeHints: ["txt", "eml", "md"],
    enabled: true,
    priority: 80,
    searchSettings: createSearchSettings({
      searchProfile: "record",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: false,
      adjacentSectionWindow: 0,
      smallToBigWindow: 0
    })
  },
  {
    key: "changelog",
    label: "Changelog",
    description: "Release Notes und Aenderungsprotokolle.",
    category: "technical",
    promptHint: "Use for changelogs, release notes, migration notes, and version histories.",
    keywords: ["changelog", "release notes", "breaking changes", "fixed", "added", "version"],
    sourceTypeHints: [],
    fileTypeHints: ["md", "txt"],
    enabled: true,
    priority: 85,
    searchSettings: createSearchSettings({
      searchProfile: "structured",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "config",
    label: "Konfiguration",
    description: "Konfigurationsdateien und Infrastrukturdefinitionen.",
    category: "technical",
    promptHint: "Use for configuration files, environment definitions, manifests, and infrastructure declarations.",
    keywords: ["database_url", "api_key", "services:", "environment:", "image:", "version:"],
    sourceTypeHints: ["git"],
    fileTypeHints: ["json", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "xml"],
    enabled: true,
    priority: 90,
    searchSettings: createSearchSettings({
      searchProfile: "code",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      smallToBigWindow: 0
    })
  },
  {
    key: "source_code",
    label: "Source Code",
    description: "Quellcode-Dateien aus Repositories oder lokalen Projekten.",
    category: "technical",
    promptHint: "Use for source code files and implementation-heavy technical artifacts from repositories.",
    keywords: ["import ", "export ", "function ", "class ", "interface ", "def ", "public class"],
    sourceTypeHints: ["git"],
    fileTypeHints: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "java", "go", "rs", "php", "rb", "sh", "sql", "html", "css", "scss"],
    enabled: true,
    priority: 95,
    searchSettings: createSearchSettings({
      searchProfile: "code",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: false,
      adjacentSectionWindow: 0,
      smallToBigWindow: 0
    })
  },
  {
    key: "book",
    label: "Buch",
    description: "Buecher, laengere PDFs und kapitelbasierte Werke.",
    category: "knowledge",
    promptHint: "Use for books, long-form reports, and chapter-based reference works.",
    keywords: ["book", "buch", "chapter", "kapitel", "isbn", "epub"],
    sourceTypeHints: [],
    fileTypeHints: ["pdf", "epub"],
    enabled: true,
    priority: 110,
    searchSettings: createSearchSettings({
      searchProfile: "narrative",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 3,
      smallToBigWindow: 2
    })
  },
  {
    key: "web",
    label: "Web",
    description: "Gecrawlte Webseiten, Blogposts und HTML-Inhalte.",
    category: "web",
    promptHint: "Use for website pages, blog articles, knowledge-base pages, and crawled HTML content.",
    keywords: ["website", "blog", "article", "web page", "html"],
    sourceTypeHints: ["crawl"],
    fileTypeHints: ["html"],
    enabled: true,
    priority: 120,
    searchSettings: createSearchSettings({
      searchProfile: "reference",
      preferContentMatches: true,
      preferDocumentFocus: true,
      requireFocusTerms: true,
      preferAdjacentSections: true,
      adjacentSectionWindow: 1,
      smallToBigWindow: 1
    })
  },
  {
    key: "generic",
    label: "Generisch",
    description: "Fallback fuer nicht klar zuordenbare Dokumente.",
    category: "generic",
    promptHint: "Use only when no more specific type applies.",
    keywords: [],
    sourceTypeHints: [],
    fileTypeHints: [],
    enabled: true,
    priority: 999,
    searchSettings: createSearchSettings()
  }
];

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
}

function normalizeSearchProfile(value: unknown): DocumentSearchProfile {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "narrative":
    case "structured":
    case "reference":
    case "record":
    case "code":
      return String(value).trim().toLowerCase() as DocumentSearchProfile;
    default:
      return "generic";
  }
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(numeric), max));
}

function normalizeSearchSettings(value: Partial<DocumentTypeSearchSettings> | undefined, fallback?: DocumentTypeSearchSettings): DocumentTypeSearchSettings {
  return {
    searchProfile: normalizeSearchProfile(value?.searchProfile ?? fallback?.searchProfile ?? "generic"),
    preferContentMatches: typeof value?.preferContentMatches === "boolean"
      ? value.preferContentMatches
      : (fallback?.preferContentMatches ?? false),
    preferDocumentFocus: typeof value?.preferDocumentFocus === "boolean"
      ? value.preferDocumentFocus
      : (fallback?.preferDocumentFocus ?? false),
    requireFocusTerms: typeof value?.requireFocusTerms === "boolean"
      ? value.requireFocusTerms
      : (fallback?.requireFocusTerms ?? false),
    preferAdjacentSections: typeof value?.preferAdjacentSections === "boolean"
      ? value.preferAdjacentSections
      : (fallback?.preferAdjacentSections ?? false),
    adjacentSectionWindow: normalizeInteger(value?.adjacentSectionWindow, fallback?.adjacentSectionWindow ?? 1, 0, 8),
    smallToBigWindow: normalizeInteger(value?.smallToBigWindow, fallback?.smallToBigWindow ?? 1, 0, 8)
  };
}

function normalizeRecord(row: DocumentTypeSettingRow): DocumentTypeSetting {
  return {
    key: row.key.trim().toLowerCase(),
    label: row.label.trim(),
    description: row.description.trim(),
    category: row.category.trim().toLowerCase(),
    promptHint: row.prompt_hint.trim(),
    keywords: normalizeStringArray(row.keywords),
    sourceTypeHints: normalizeStringArray(row.source_type_hints),
    fileTypeHints: normalizeStringArray(row.file_type_hints),
    enabled: Boolean(row.enabled),
    priority: Number.isFinite(row.priority) ? row.priority : 100,
    searchSettings: normalizeSearchSettings({
      preferContentMatches: row.prefer_content_matches,
      preferDocumentFocus: row.prefer_document_focus,
      requireFocusTerms: row.require_focus_terms,
      preferAdjacentSections: row.prefer_adjacent_sections,
      adjacentSectionWindow: row.adjacent_section_window,
      smallToBigWindow: row.small_to_big_window
    }, {
      ...createSearchSettings(),
      searchProfile: normalizeSearchProfile(row.search_profile)
    })
  };
}

function sortSettings(settings: DocumentTypeSetting[]): DocumentTypeSetting[] {
  return [...settings].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.key.localeCompare(right.key);
  });
}

let cachedSettings = sortSettings(DEFAULT_DOCUMENT_TYPE_SETTINGS);
let initialized = false;
let loadingPromise: Promise<DocumentTypeSetting[]> | null = null;

async function seedDefaults() {
  for (const setting of DEFAULT_DOCUMENT_TYPE_SETTINGS) {
    await pool.query(
      `
        INSERT INTO document_type_settings (
          key, label, description, category, prompt_hint, keywords, source_type_hints, file_type_hints, enabled, priority,
          search_profile, prefer_content_matches, prefer_document_focus, require_focus_terms, prefer_adjacent_sections,
          adjacent_section_window, small_to_big_window
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (key) DO NOTHING
      `,
      [
        setting.key,
        setting.label,
        setting.description,
        setting.category,
        setting.promptHint,
        JSON.stringify(setting.keywords),
        JSON.stringify(setting.sourceTypeHints),
        JSON.stringify(setting.fileTypeHints),
        setting.enabled,
        setting.priority,
        setting.searchSettings.searchProfile,
        setting.searchSettings.preferContentMatches,
        setting.searchSettings.preferDocumentFocus,
        setting.searchSettings.requireFocusTerms,
        setting.searchSettings.preferAdjacentSections,
        setting.searchSettings.adjacentSectionWindow,
        setting.searchSettings.smallToBigWindow
      ]
    );
  }
}

export async function ensureDocumentTypeSettingsLoaded(force = false): Promise<DocumentTypeSetting[]> {
  if (initialized && !force) {
    return cachedSettings;
  }

  if (loadingPromise && !force) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    await seedDefaults();
    const result = await pool.query<DocumentTypeSettingRow>(
      `
        SELECT key, label, description, category, prompt_hint, keywords, source_type_hints, file_type_hints, enabled, priority,
               search_profile, prefer_content_matches, prefer_document_focus, require_focus_terms, prefer_adjacent_sections,
               adjacent_section_window, small_to_big_window
        FROM document_type_settings
        ORDER BY priority ASC, key ASC
      `
    );

    cachedSettings = sortSettings(result.rows.map(normalizeRecord));
    initialized = true;
    loadingPromise = null;
    return cachedSettings;
  })().catch((error) => {
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}

export function getDocumentTypeSettingsSnapshot(): DocumentTypeSetting[] {
  return cachedSettings;
}

export function getEnabledDocumentTypeSettingsSnapshot(): DocumentTypeSetting[] {
  return cachedSettings.filter((setting) => setting.enabled);
}

export function getDocumentTypeSettingByKey(key: string | null | undefined): DocumentTypeSetting | null {
  const normalized = key?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return cachedSettings.find((setting) => setting.key === normalized) ?? null;
}

export function normalizeDocumentTypeKey(value: unknown, fallback = "generic"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return cachedSettings.some((setting) => setting.key === normalized) ? normalized : fallback;
}

export function inferDocumentTypeFromSettings(document: {
  title?: string | null;
  sourceRef?: string | null;
  sourceType?: string | null;
  fileType?: string | null;
}): string {
  const haystack = [document.title, document.sourceRef, document.fileType, document.sourceType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const sourceType = document.sourceType?.trim().toLowerCase() ?? "";
  const fileType = document.fileType?.trim().toLowerCase() ?? "";

  for (const setting of getEnabledDocumentTypeSettingsSnapshot()) {
    if (setting.key === "generic") {
      continue;
    }

    const matchesSourceType = sourceType && setting.sourceTypeHints.some((hint) => sourceType.includes(hint));
    const matchesFileType = fileType && setting.fileTypeHints.some((hint) => fileType === hint || fileType.includes(hint));
    const matchesKeyword = setting.keywords.some((keyword) => haystack.includes(keyword));

    if (matchesSourceType || matchesFileType || matchesKeyword) {
      return setting.key;
    }
  }

  return "generic";
}

export async function updateDocumentTypeSetting(
  key: string,
  input: Partial<Omit<DocumentTypeSetting, "key">>
): Promise<DocumentTypeSetting | null> {
  await ensureDocumentTypeSettingsLoaded();

  const existing = cachedSettings.find((setting) => setting.key === key);
  if (!existing) {
    return null;
  }

  const next: DocumentTypeSetting = {
    key: existing.key,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : existing.label,
    description: typeof input.description === "string" ? input.description.trim() : existing.description,
    category: typeof input.category === "string" && input.category.trim() ? input.category.trim().toLowerCase() : existing.category,
    promptHint: typeof input.promptHint === "string" ? input.promptHint.trim() : existing.promptHint,
    keywords: input.keywords ? normalizeStringArray(input.keywords) : existing.keywords,
    sourceTypeHints: input.sourceTypeHints ? normalizeStringArray(input.sourceTypeHints) : existing.sourceTypeHints,
    fileTypeHints: input.fileTypeHints ? normalizeStringArray(input.fileTypeHints) : existing.fileTypeHints,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing.enabled,
    priority: typeof input.priority === "number" && Number.isFinite(input.priority) ? Math.max(1, Math.min(Math.floor(input.priority), 9999)) : existing.priority,
    searchSettings: normalizeSearchSettings(input.searchSettings, existing.searchSettings)
  };

  await pool.query(
    `
      UPDATE document_type_settings
      SET label = $2,
          description = $3,
          category = $4,
          prompt_hint = $5,
          keywords = $6::jsonb,
          source_type_hints = $7::jsonb,
          file_type_hints = $8::jsonb,
          enabled = $9,
          priority = $10,
          search_profile = $11,
          prefer_content_matches = $12,
          prefer_document_focus = $13,
          require_focus_terms = $14,
          prefer_adjacent_sections = $15,
          adjacent_section_window = $16,
          small_to_big_window = $17,
          updated_at = NOW()
      WHERE key = $1
    `,
    [
      next.key,
      next.label,
      next.description,
      next.category,
      next.promptHint,
      JSON.stringify(next.keywords),
      JSON.stringify(next.sourceTypeHints),
      JSON.stringify(next.fileTypeHints),
      next.enabled,
      next.priority,
      next.searchSettings.searchProfile,
      next.searchSettings.preferContentMatches,
      next.searchSettings.preferDocumentFocus,
      next.searchSettings.requireFocusTerms,
      next.searchSettings.preferAdjacentSections,
      next.searchSettings.adjacentSectionWindow,
      next.searchSettings.smallToBigWindow
    ]
  );

  await ensureDocumentTypeSettingsLoaded(true);
  return cachedSettings.find((setting) => setting.key === key) ?? next;
}