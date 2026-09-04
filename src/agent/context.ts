import { SystemMessage, type AIMessage } from "@langchain/core/messages";
import { loadPrompt, loadCompanyInfo } from "../prompts/loader.js";
import { config } from "../settings/config.js";
import { getCollectionsSync } from "../products/collections.js";
import type { Conversion } from "./state.js";

export function textOf(m: AIMessage): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content.map((p) => (typeof p === "string" ? p : "text" in p ? p.text : "")).join("");
  }
  return String(m.content ?? "");
}

export function commercialSystem(): SystemMessage {
  const parts = [loadPrompt("system")];
  if (config.shop.api.key) {
    const cols = getCollectionsSync()
      .map((c) => `${c.name} (slug: ${c.slug}) → ${c.url}`)
      .join("\n");
    parts.push(`# Colecciones (slug para el filtro collection; url = link real de la colección)\n${cols}`);
  }
  const company = loadCompanyInfo();
  if (company) parts.push(`# Info de empresa (políticas/FAQ; NO productos)\n${company}`);
  return new SystemMessage(parts.join("\n\n"));
}

export function normalizeConversion(c: unknown): Conversion {
  const o = (c ?? {}) as Record<string, unknown>;
  return {
    recommendedProduct: Boolean(o.recommendedProduct),
    sentLink: Boolean(o.sentLink),
    purchaseIntent: Boolean(o.purchaseIntent),
  };
}
