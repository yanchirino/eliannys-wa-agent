import { Hono } from "hono";
import { invoke } from "../agent/index.js";
import { config } from "../settings/config.js";
import { verifyChallenge, verifySignature, parseInbound, seenBefore, type Inbound } from "../channels/whatsapp/webhook.js";
import { sendMessage, markReadAndType } from "../channels/whatsapp/client.js";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/webhook", (c) => {
  const ok = verifyChallenge(
    c.req.query("hub.mode"),
    c.req.query("hub.verify_token"),
    c.req.query("hub.challenge") ?? "",
  );
  return ok !== null ? c.text(ok, 200) : c.text("forbidden", 403);
});

async function handleInbound(inbound: Inbound): Promise<void> {
  await markReadAndType(inbound.messageId);
  const { messages } = await invoke(inbound.text, inbound.from);
  for (const m of messages) await sendMessage(inbound.from, m);
}

app.post("/webhook", async (c) => {
  const raw = await c.req.text();
  if (!verifySignature(raw, c.req.header("x-hub-signature-256"))) return c.text("invalid signature", 401);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.text("bad request", 400);
  }
  const firstType = (body as { entry?: { changes?: { value?: { messages?: { type?: string }[] } }[] }[] })?.entry?.[0]
    ?.changes?.[0]?.value?.messages?.[0]?.type;
  const inbound = parseInbound(body);
  if (!inbound) {
    console.log(`wa webhook: type=${firstType ?? "none"} → ignored`);
  } else if (seenBefore(inbound.messageId)) {
    console.log(`wa webhook: type=${firstType} id=${inbound.messageId} → duplicate`);
  } else {
    console.log(`wa webhook: type=${firstType} from=${inbound.from} text="${inbound.text}" → handling`);
    handleInbound(inbound).catch((err) =>
      console.error("whatsapp handler:", err instanceof Error ? err.message : String(err)),
    );
  }
  return c.text("EVENT_RECEIVED", 200);
});

app.post("/message", async (c) => {
  if (config.agentToken) {
    const auth = c.req.header("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== config.agentToken) return c.json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const b = body as { input?: unknown; thread_id?: unknown };
  const input = typeof b?.input === "string" ? b.input.trim() : "";
  if (!input) return c.json({ error: "field 'input' (non-empty string) is required" }, 400);
  const threadId = typeof b?.thread_id === "string" && b.thread_id.trim() ? b.thread_id.trim() : undefined;

  try {
    return c.json(await invoke(input, threadId));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
