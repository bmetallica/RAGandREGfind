import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";
import { logger } from "../utils/logger";
import { backfillStoredDocumentStructures } from "../services/documentService";
import { backfillStoredDocumentFiles } from "../services/originalFileService";

async function runMigrations() {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const migrationPath = path.join(migrationsDir, fileName);
    const sql = await readFile(migrationPath, "utf8");
    await pool.query(sql);
    logger.info({ migrationPath }, "database migration completed");
  }

  const result = await backfillStoredDocumentStructures();
  logger.info({ processed: result.processed }, "document structure backfill completed");

  const documentFileResult = await backfillStoredDocumentFiles();
  logger.info({ processed: documentFileResult.processed }, "document file backfill completed");
}

runMigrations()
  .catch((error) => {
    logger.error({ err: error }, "database migration failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
