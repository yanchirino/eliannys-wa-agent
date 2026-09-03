import { config } from "../../settings/config.js";
import type { OutMessage } from "../../agent/messages.js";
import { renderMessage } from "./render.js";

function endpoint(): string {
  const { graphVersion, phoneNumberId } = config.whatsapp;
  return `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
}

async function post(payload: Record<string, unknown>, label: string): Promise<void> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown };
      detail = JSON.stringify(body.error ?? body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    console.error(`whatsapp ${label} failed: ${res.status} ${detail}`);
  }
}

export async function sendMessage(to: string, m: OutMessage): Promise<void> {
  await post(renderMessage(to, m), `send:${m.type}`);
}

export async function markReadAndType(messageId: string): Promise<void> {
  await post(
    { messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } },
    "typing/read",
  );
}
