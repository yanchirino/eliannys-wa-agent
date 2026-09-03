import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../settings/config.js";

// En Workers no hay filesystem: el entry bundlea los .md y los inyecta aquí.
// En Node (dev) no se inyecta bundle y se leen del disco (permite editar sin recompilar).
let bundle: Record<string, string> | null = null;

export function setPromptBundle(b: Record<string, string>): void {
  bundle = b;
}

export function loadPrompt(name: string): string {
  if (bundle && bundle[name] != null) return bundle[name].trim();
  return readFileSync(join(config.prompts.dir, `${name}.md`), "utf8").trim();
}

export function loadCompanyInfo(): string {
  try {
    return loadPrompt("empresa");
  } catch {
    return "";
  }
}
