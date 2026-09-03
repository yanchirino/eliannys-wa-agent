import type { D1Database } from "./d1-saver.js";

// El binding D1 se inyecta desde el entrypoint: main.ts (dev, vía getPlatformProxy)
// o worker.ts (Workers, vía env.DB). Así d1.ts no depende de wrangler y no se bundlea en el Worker.
let injected: D1Database | null = null;

export function setD1Binding(db: unknown): void {
  injected = (db as D1Database) ?? null;
}

export function getDB(): Promise<D1Database | null> {
  return Promise.resolve(injected);
}
