import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";
import { ensureAdminCredentialsBootstrap } from "../services/adminAuthService";
import { ensureDocumentTypeSettingsLoaded } from "../services/documentTypeRegistryService";
import { backfillStoredDocumentStructures } from "../services/documentService";
import { backfillStoredDocumentFiles } from "../services/originalFileService";

export default async function runStartupMigrations() {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const migrationPath = path.join(migrationsDir, fileName);
    const sql = await readFile(migrationPath, "utf8");
    await pool.query(sql);
  }

  await ensureAdminCredentialsBootstrap();
  await ensureDocumentTypeSettingsLoaded();
  await backfillStoredDocumentStructures();
  await backfillStoredDocumentFiles();
}
