import { mkdir } from "node:fs/promises";
import { Worker } from "bullmq";
import { env } from "../config/env";
import runStartupMigrations from "../db/startupMigrations";
import { crawlQueue, gitRepoSyncQueue, ingestQueue, redisConnection, syncQueue, CrawlJobPayload, GitRepoSyncJobPayload, IngestJobPayload, SyncJobPayload } from "../queues";
import { CrawlService } from "../services/crawlService";
import { DirectorySyncService } from "../services/directorySyncService";
import { GitRepositorySyncService } from "../services/gitRepositorySyncService";
import { IngestionService } from "../services/ingestionService";
import { logger } from "../utils/logger";

async function startWorker() {
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await mkdir(env.IMPORT_DIR, { recursive: true });
  await mkdir(env.ORIGINAL_STORAGE_DIR, { recursive: true });
  await mkdir(env.GIT_REPO_CACHE_DIR, { recursive: true });

  await runStartupMigrations();

  const crawlService = new CrawlService();
  const directorySyncService = new DirectorySyncService();
  const gitRepositorySyncService = new GitRepositorySyncService();
  const ingestionService = new IngestionService();

  const crawlWorker = new Worker<CrawlJobPayload>(
    crawlQueue.name,
    async (job) => crawlService.crawl(job.data),
    { connection: redisConnection, concurrency: 2 }
  );

  const syncWorker = new Worker<SyncJobPayload>(
    syncQueue.name,
    async (job) => directorySyncService.sync(job.data.rootDir, job.data.knowledgeBaseId ?? null),
    { connection: redisConnection, concurrency: 1 }
  );

  const ingestWorker = new Worker<IngestJobPayload>(
    ingestQueue.name,
    async (job) => ingestionService.ingestFile(job.data),
    { connection: redisConnection, concurrency: 2 }
  );

  const gitRepoSyncWorker = new Worker<GitRepoSyncJobPayload>(
    gitRepoSyncQueue.name,
    async (job) => gitRepositorySyncService.sync(job.data),
    { connection: redisConnection, concurrency: 1 }
  );

  for (const worker of [crawlWorker, syncWorker, ingestWorker, gitRepoSyncWorker]) {
    worker.on("completed", (job, result) => {
      logger.info({ queue: worker.name, jobId: job?.id, result }, "job completed");
    });
    worker.on("failed", (job, error) => {
      logger.error({ queue: worker.name, jobId: job?.id, err: error }, "job failed");
    });
  }

  logger.info("workers started");
}

startWorker().catch((error) => {
  logger.error({ err: error }, "failed to start worker");
  process.exit(1);
});
