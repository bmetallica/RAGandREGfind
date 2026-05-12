import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "../db/pool";

const scryptAsync = promisify(scrypt);

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin";

interface AdminCredentialRow {
  id: number;
  username: string;
  password_hash: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  createdAt: string;
  updatedAt: string;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, expectedHash] = storedHash.split(":");
  if (scheme !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = await scryptAsync(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedBuffer);
}

async function getAdminCredential(username: string): Promise<AdminCredentialRow | null> {
  const result = await pool.query<AdminCredentialRow>(
    `
      SELECT id, username, password_hash
      FROM admin_credentials
      WHERE lower(username) = lower($1)
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] ?? null;
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function validateUsername(username: string): void {
  if (!username) {
    throw new Error("username is required");
  }

  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    throw new Error("username must be 3-64 characters and use only letters, numbers, dot, underscore or hyphen");
  }
}

function validateNewPassword(password: string): void {
  if (!password || password.length < 5) {
    throw new Error("new password must be at least 5 characters long");
  }
}

export async function ensureAdminCredentialsBootstrap(): Promise<void> {
  const result = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_credentials");
  if (Number(result.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await pool.query(
    `
      INSERT INTO admin_credentials (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING
    `,
    [DEFAULT_ADMIN_USERNAME, passwordHash]
  );
}

export async function authenticateAdminUser(username: string, password: string): Promise<boolean> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    return false;
  }

  const credential = await getAdminCredential(normalizedUsername);
  if (!credential) {
    return false;
  }

  return verifyPassword(password, credential.password_hash);
}

export async function changeAdminPassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    throw new Error("admin username is required");
  }

  if (!currentPassword) {
    throw new Error("current password is required");
  }

  validateNewPassword(newPassword);

  const credential = await getAdminCredential(normalizedUsername);
  if (!credential) {
    throw new Error("admin user not found");
  }

  const currentPasswordValid = await verifyPassword(currentPassword, credential.password_hash);
  if (!currentPasswordValid) {
    throw new Error("current password is invalid");
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(
    `
      UPDATE admin_credentials
      SET password_hash = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [credential.id, passwordHash]
  );
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const result = await pool.query<Required<Pick<AdminCredentialRow, "id" | "username" | "created_at" | "updated_at">>>(
    `
      SELECT id, username, created_at::text, updated_at::text
      FROM admin_credentials
      ORDER BY lower(username) ASC, id ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createAdminUser(username: string, password: string): Promise<AdminUserRecord> {
  const normalizedUsername = normalizeUsername(username);
  validateUsername(normalizedUsername);
  validateNewPassword(password);

  const existing = await getAdminCredential(normalizedUsername);
  if (existing) {
    throw new Error("admin user already exists");
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query<Required<Pick<AdminCredentialRow, "id" | "username" | "created_at" | "updated_at">>>(
    `
      INSERT INTO admin_credentials (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at::text, updated_at::text
    `,
    [normalizedUsername, passwordHash]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}