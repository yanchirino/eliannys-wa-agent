export type OutMessage =
  | { type: "text"; text: string }
  | { type: "product_card"; imageUrl: string; title: string; subtitle?: string; url: string; button: string }
  | { type: "buttons"; text: string; buttons: { id: string; title: string }[] }
  | { type: "link"; text: string; url: string; button: string };

const FALLBACK: OutMessage = {
  type: "text",
  text: "¿Te ayudo con algo más? Puedes ver todo en https://eliannys.com/shop 💛",
};

function hasContent(m: OutMessage): boolean {
  if (m.type === "text") return Boolean(m.text?.trim());
  if (m.type === "product_card") return Boolean(m.url && m.title);
  if (m.type === "link") return Boolean(m.url && m.text?.trim());
  return Boolean(m.text?.trim() && m.buttons?.length);
}

export function coerceOutMessages(raw: unknown): OutMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: OutMessage[] = [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    if (o.type === "text" && typeof o.text === "string") {
      out.push({ type: "text", text: o.text });
    } else if (o.type === "product_card" && typeof o.url === "string" && typeof o.title === "string") {
      out.push({
        type: "product_card",
        imageUrl: String(o.imageUrl ?? ""),
        title: o.title,
        subtitle: o.subtitle ? String(o.subtitle) : undefined,
        url: o.url,
        button: String(o.button ?? "Ver"),
      });
    } else if (o.type === "link" && typeof o.url === "string" && typeof o.text === "string") {
      out.push({ type: "link", text: o.text, url: o.url, button: String(o.button ?? "Ver") });
    } else if (o.type === "buttons" && typeof o.text === "string" && Array.isArray(o.buttons)) {
      const buttons = o.buttons
        .slice(0, 3)
        .map((b, i) => {
          const bo = (b ?? {}) as Record<string, unknown>;
          return { id: String(bo.id ?? i), title: String(bo.title ?? "") };
        })
        .filter((b) => b.title);
      out.push({ type: "buttons", text: o.text, buttons });
    }
  }
  return out;
}

export function sanitizeMessages(msgs: OutMessage[]): OutMessage[] {
  const cleaned = msgs
    .filter(hasContent)
    .slice(0, 2)
    .map((m) => (m.type === "buttons" ? { ...m, buttons: m.buttons.slice(0, 3) } : m));
  return cleaned.length ? cleaned : [FALLBACK];
}

export function slugFromUrl(url: string): string | null {
  const m = url.match(/\/product\/([^/?#]+)/i);
  return m ? m[1] : null;
}

export function outToText(m: OutMessage): string {
  if (m.type === "text") return m.text;
  if (m.type === "product_card") return `${m.title}${m.subtitle ? ` — ${m.subtitle}` : ""}\n${m.url}`;
  if (m.type === "link") return `${m.text}\n${m.url}`;
  return `${m.text} [${m.buttons.map((b) => b.title).join(" / ")}]`;
}
