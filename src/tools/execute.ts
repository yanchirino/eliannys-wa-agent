import { getTool } from "./registry.js";
import { checkPermission } from "./permission.js";

export async function executeToolCall(name: string, rawArgs: unknown): Promise<string> {
  const tool = getTool(name);
  if (!tool) return `Error: unknown tool "${name}".`;

  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) return `Invalid arguments for "${name}": ${parsed.error.message}`;

  const perm = checkPermission(tool, parsed.data);
  if (!perm.allowed) return `Permission denied for "${name}": ${perm.reason ?? "not allowed"}`;

  try {
    return String(await tool.run(parsed.data));
  } catch (err) {
    return `Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
