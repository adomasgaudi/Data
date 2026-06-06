/**
 * Full-site backup / restore.
 *
 * Every edit the owner makes on the site — code names, short names, categories
 * & muscle tiers, notes, "not comparable"/HSPU tags, hand-logged sets, reps,
 * RPE, per-set overrides, coefficients, team picks, taxonomy, … — is saved
 * ONLY in the browser's localStorage, under the "colosseum." prefix. Nothing is
 * on a server. So clearing the browser cache (or switching browser/phone) loses
 * the lot.
 *
 * This module snapshots ALL of those keys into one portable JSON file and writes
 * them back, so a cache wipe can't lose anything you've kept a backup of. It is
 * deliberately pure (works against any `StorageLike`) so it can be unit-tested
 * without a real browser — see backup.test.ts.
 */

/** Every backed-up key starts with this. */
export const BACKUP_PREFIX = "colosseum.";

/**
 * Keys we never put in a backup: the auto-backup bookkeeping itself. Everything
 * else under the prefix IS backed up — including theme/login, so a restore on a
 * fresh device brings the whole experience back. (These two are device-local
 * plumbing that would be meaningless or circular to carry across.)
 */
export const BACKUP_SKIP: ReadonlySet<string> = new Set<string>([
  "colosseum.__autobackupAt.v1", // last auto-backup timestamp
  "colosseum.__autobackupOn.v1", // whether live auto-backup is armed
]);

/** The minimal slice of the Web Storage API this module needs. */
export interface StorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Current backup file format. Bump only if the shape changes incompatibly. */
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: "colosseum";
  kind: "full-backup";
  /** Backup file-format version (not the app version). */
  format: number;
  /** ISO timestamp the backup was taken. */
  exportedAt: string;
  /** App version (CURRENT_VERSION) at export time, for reference. */
  appVersion?: string | undefined;
  /** Raw localStorage key → value map (values are JSON/strings as stored). */
  data: Record<string, string>;
}

/** True when `key` is one we should include in a backup. */
function isBackedUp(key: string | null): key is string {
  return !!key && key.startsWith(BACKUP_PREFIX) && !BACKUP_SKIP.has(key);
}

/** Snapshot every backup-worthy `colosseum.*` key currently in `storage`. */
export function collectBackup(
  storage: StorageLike,
  appVersion?: string,
  now: Date = new Date(),
): BackupFile {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!isBackedUp(k)) continue;
    const v = storage.getItem(k);
    if (v !== null) data[k] = v;
  }
  return {
    app: "colosseum",
    kind: "full-backup",
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    appVersion,
    data,
  };
}

/** Serialize a backup to the exact text written to a `.json` file. */
export function backupToText(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse & validate a backup file's text. Throws a plain-language Error if the
 * file isn't a Colosseum full backup, so the UI can show it verbatim.
 */
export function parseBackup(text: string): BackupFile {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("That file isn't readable (not valid JSON).");
  }
  if (!obj || typeof obj !== "object") throw new Error("That file isn't a backup.");
  const o = obj as Record<string, unknown>;
  if (o.app !== "colosseum" || o.kind !== "full-backup" || typeof o.data !== "object" || o.data === null)
    throw new Error("That file isn't a Colosseum full backup.");

  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.data as Record<string, unknown>))
    if (k.startsWith(BACKUP_PREFIX) && typeof v === "string") data[k] = v;

  return {
    app: "colosseum",
    kind: "full-backup",
    format: typeof o.format === "number" ? o.format : 0,
    exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : "",
    appVersion: typeof o.appVersion === "string" ? o.appVersion : undefined,
    data,
  };
}

export interface RestoreResult {
  /** How many keys were written. */
  restored: number;
}

/**
 * Write a backup's keys back into `storage`.
 *
 * - `"merge"` (default): set every key from the backup, overwriting matches and
 *   leaving any keys NOT in the backup untouched. Safest — only ever adds back.
 * - `"replace"`: first delete every backup-worthy `colosseum.*` key, then write
 *   the backup. An exact restore to the file's moment in time.
 */
export function applyBackup(
  storage: StorageLike,
  backup: BackupFile,
  mode: "merge" | "replace" = "merge",
): RestoreResult {
  if (mode === "replace") {
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (isBackedUp(k)) toRemove.push(k);
    }
    for (const k of toRemove) storage.removeItem(k);
  }
  let restored = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (BACKUP_SKIP.has(k) || !k.startsWith(BACKUP_PREFIX)) continue;
    storage.setItem(k, v);
    restored++;
  }
  return { restored };
}

/** A short, human filename for a backup taken now, e.g. colosseum-backup-2026-06-06.json */
export function backupFilename(now: Date = new Date()): string {
  return `colosseum-backup-${now.toISOString().slice(0, 10)}.json`;
}
