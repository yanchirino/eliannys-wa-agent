import { config } from "../settings/config.js";
import type { D1Database } from "./d1-saver.js";

let dbPromise: Promise<D1Database | null> | null = null;

async function resolveDB(): Promise<D1Database | null> {
  if (!config.memory.useD1) return null;
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy();
  const db = (proxy.env as Record<string, unknown>).DB as D1Database | undefined;
  return db ?? null;
}

export function getDB(): Promise<D1Database | null> {
  return (dbPromise ??= resolveDB());
}
