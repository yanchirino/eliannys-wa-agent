import type { OutMessage } from "../../agent/messages.js";

// WhatsApp solo acepta jpg/png (webp da error #131053). jpg/png pasa directo; el resto (webp) se
// convierte al vuelo con el proxy público images.weserv.nl.
export function toWaImageUrl(url: string): string {
  if (/\.(jpe?g|png)(\?|$)/i.test(url)) return url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
}

export function renderMessage(to: string, m: OutMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", to };

  if (m.type === "text") {
    return { ...base, type: "text", text: { body: m.text } };
  }

  if (m.type === "product_card") {
    const body = [m.title, m.subtitle].filter(Boolean).join("\n");
    const header = m.imageUrl ? { header: { type: "image", image: { link: toWaImageUrl(m.imageUrl) } } } : {};
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "cta_url",
        ...header,
        body: { text: body },
        action: { name: "cta_url", parameters: { display_text: m.button, url: m.url } },
      },
    };
  }

  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: m.text },
      action: {
        buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  };
}
