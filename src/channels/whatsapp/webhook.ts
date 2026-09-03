import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../settings/config.js";

export interface Inbound {
  from: string;
  text: string;
  messageId: string;
}

export function verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string): string | null {
  const expected = config.whatsapp.verifyToken;
  return mode === "subscribe" && !!expected && token === expected ? challenge : null;
}

export function verifySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = config.whatsapp.appSecret;
  if (!signature || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseInbound(body: unknown): Inbound | null {
  const value = (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })?.entry?.[0]?.changes?.[0]
    ?.value;
  const msg = (value?.messages as Record<string, unknown>[] | undefined)?.[0];
  if (!msg) return null;

  let text = "";
  if (msg.type === "text") {
    text = String((msg.text as { body?: string })?.body ?? "");
  } else if (msg.type === "interactive") {
    const i = msg.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } };
    text = i?.button_reply?.title ?? i?.list_reply?.title ?? "";
  } else if (msg.type === "button") {
    text = String((msg.button as { text?: string })?.text ?? "");
  }
  if (!text) return null;
  return { from: String(msg.from), text, messageId: String(msg.id) };
}

const seen = new Set<string>();
export function seenBefore(id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 1000) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}
