import type { Tool } from "./types.js";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// Default-allow stub. Real deny-first policies plug in here without changing callers.
export function checkPermission(_tool: Tool, _input: unknown): PermissionResult {
  return { allowed: true };
}
