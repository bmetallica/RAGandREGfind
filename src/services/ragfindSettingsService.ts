import { pool } from "../db/pool";
import { listKnowledgeBases, type KnowledgeBaseRecord } from "./adminAccessService";

export interface RagfindSettingsRecord {
  knowledgeBaseIds: number[];
  knowledgeBases: Array<{
    id: number;
    slug: string;
    name: string;
    isEnabled: boolean;
  }>;
  updatedAt: string | null;
}

interface RagfindSettingsRow {
  knowledge_base_ids: number[] | string[] | null;
  updated_at: string;
}

function normalizeKnowledgeBaseIds(values: Array<number | string>): number[] {
  return [...new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  )];
}

function mapSettings(row: RagfindSettingsRow | undefined, knowledgeBases: KnowledgeBaseRecord[]): RagfindSettingsRecord {
  const configuredIds = normalizeKnowledgeBaseIds(row?.knowledge_base_ids ?? []);
  const configuredKnowledgeBases = configuredIds
    .map((knowledgeBaseId) => knowledgeBases.find((entry) => Number(entry.id) === knowledgeBaseId))
    .filter((entry): entry is KnowledgeBaseRecord => Boolean(entry))
    .map((entry) => ({
      id: Number(entry.id),
      slug: entry.slug,
      name: entry.name,
      isEnabled: entry.isEnabled
    }));

  return {
    knowledgeBaseIds: configuredKnowledgeBases.map((entry) => entry.id),
    knowledgeBases: configuredKnowledgeBases,
    updatedAt: row?.updated_at ?? null
  };
}

function getLegacyDefaultKnowledgeBaseIds(knowledgeBases: KnowledgeBaseRecord[]): number[] {
  const defaultKnowledgeBase = knowledgeBases.find((entry) => entry.slug === "default" && entry.isEnabled !== false);
  return defaultKnowledgeBase ? [Number(defaultKnowledgeBase.id)] : [];
}

export async function getRagfindSettings(): Promise<RagfindSettingsRecord> {
  const [knowledgeBases, settingsResult] = await Promise.all([
    listKnowledgeBases(),
    pool.query<RagfindSettingsRow>(
      `
        SELECT knowledge_base_ids, updated_at::text
        FROM ragfind_settings
        WHERE singleton = TRUE
        LIMIT 1
      `
    )
  ]);

  const settings = mapSettings(settingsResult.rows[0], knowledgeBases);
  if (settings.knowledgeBaseIds.length > 0) {
    return settings;
  }

  const fallbackKnowledgeBaseIds = getLegacyDefaultKnowledgeBaseIds(knowledgeBases);
  if (fallbackKnowledgeBaseIds.length === 0) {
    return settings;
  }

  await pool.query(
    `
      INSERT INTO ragfind_settings (singleton, knowledge_base_ids, updated_at)
      VALUES (TRUE, $1::bigint[], NOW())
      ON CONFLICT (singleton)
      DO UPDATE SET
        knowledge_base_ids = EXCLUDED.knowledge_base_ids,
        updated_at = NOW()
    `,
    [fallbackKnowledgeBaseIds]
  );

  return mapSettings(
    {
      knowledge_base_ids: fallbackKnowledgeBaseIds,
      updated_at: new Date().toISOString()
    },
    knowledgeBases
  );
}

export async function updateRagfindSettings(input: { knowledgeBaseIds: number[] }): Promise<RagfindSettingsRecord> {
  const knowledgeBases = await listKnowledgeBases();
  const requestedIds = normalizeKnowledgeBaseIds(input.knowledgeBaseIds);
  if (requestedIds.length === 0) {
    throw new Error("at least one knowledge base must be selected for RAGfind");
  }
  const existingIds = new Set(knowledgeBases.map((entry) => Number(entry.id)));
  const missingIds = requestedIds.filter((knowledgeBaseId) => !existingIds.has(knowledgeBaseId));
  if (missingIds.length > 0) {
    throw new Error(`unknown knowledge base ids: ${missingIds.join(", ")}`);
  }

  await pool.query(
    `
      INSERT INTO ragfind_settings (singleton, knowledge_base_ids, updated_at)
      VALUES (TRUE, $1::bigint[], NOW())
      ON CONFLICT (singleton)
      DO UPDATE SET
        knowledge_base_ids = EXCLUDED.knowledge_base_ids,
        updated_at = NOW()
    `,
    [requestedIds]
  );

  return getRagfindSettings();
}

export async function resolveRagfindKnowledgeBaseScope(): Promise<{
  knowledgeBaseIds: number[];
  knowledgeBases: KnowledgeBaseRecord[];
}> {
  const [knowledgeBases, settings] = await Promise.all([
    listKnowledgeBases(),
    getRagfindSettings()
  ]);

  const activeKnowledgeBases = settings.knowledgeBaseIds
    .map((knowledgeBaseId) => knowledgeBases.find((entry) => Number(entry.id) === knowledgeBaseId && entry.isEnabled !== false))
    .filter((entry): entry is KnowledgeBaseRecord => Boolean(entry));

  if (activeKnowledgeBases.length === 0) {
    throw new Error("RAGfind has no enabled knowledge bases configured");
  }

  return {
    knowledgeBaseIds: activeKnowledgeBases.map((entry) => Number(entry.id)),
    knowledgeBases: activeKnowledgeBases
  };
}