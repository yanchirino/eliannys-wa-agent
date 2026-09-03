import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../settings/config.js";

export function loadPrompt(name: string): string {
  return readFileSync(join(config.prompts.dir, `${name}.md`), "utf8").trim();
}

export function loadCompanyInfo(): string {
  try {
    return loadPrompt("empresa");
  } catch {
    return "";
  }
}
