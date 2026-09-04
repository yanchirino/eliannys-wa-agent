import assert from "node:assert/strict";
import { z } from "zod";
import { extractJson } from "../src/shared/json.js";
import { normalizeConversion } from "../src/agent/context.js";
import { routeAfterDraft, routeAfterCritique } from "../src/agent/routing.js";
import { isTransient } from "../src/llm/query-engine.js";
import { registerTool, tools } from "../src/tools/registry.js";
import { executeToolCall } from "../src/tools/execute.js";
import { buildProductsQuery, copToCents, buildOrderBody } from "../src/products/client.js";
import { formatPrice, formatProduct } from "../src/products/format.js";
import { getCollectionsSync } from "../src/products/collections.js";
import { renderMessage, toWaImageUrl } from "../src/channels/whatsapp/render.js";
import { verifySignature, seenBefore } from "../src/channels/whatsapp/webhook.js";
import { coerceOutMessages, sanitizeMessages, slugFromUrl } from "../src/agent/messages.js";

assert.deepEqual(extractJson('{"ready":true,"fixes":[]}'), { ready: true, fixes: [] });
assert.equal(extractJson<{ ok?: number }>('prefix {"ok":1} suffix')?.ok, 1);
assert.equal(extractJson("no json here"), null);
assert.equal(extractJson("{bad json"), null);

assert.deepEqual(normalizeConversion({ recommendedProduct: true }), {
  recommendedProduct: true,
  sentLink: false,
  purchaseIntent: false,
});
assert.deepEqual(normalizeConversion(null), { recommendedProduct: false, sentLink: false, purchaseIntent: false });

assert.equal(isTransient({ status: 429 }), true);
assert.equal(isTransient({ status: 400 }), false);
assert.equal(isTransient(new Error("request timeout")), true);

registerTool({ name: "echo", description: "echo text", schema: z.object({ text: z.string() }), run: (a) => a.text });
assert.match(await executeToolCall("echo", { text: 123 }), /Invalid arguments/);
assert.equal(await executeToolCall("echo", { text: "hi" }), "hi");
assert.match(await executeToolCall("missing", {}), /unknown tool/);
tools.length = 0;

const withTools = { lastMessage: { tool_calls: [{ name: "x", args: {} }] } };
assert.equal(routeAfterDraft({ ...withTools, toolTurns: 0 } as never), "tools");
assert.equal(routeAfterDraft({ ...withTools, toolTurns: 999 } as never), "reflect");
assert.equal(routeAfterCritique({ shouldRefine: true, iterations: 0 } as never), "generate");
assert.equal(routeAfterCritique({ shouldRefine: true, iterations: 999 } as never), "compose");
assert.equal(routeAfterCritique({ shouldRefine: false, iterations: 0 } as never), "compose");

assert.equal(slugFromUrl("https://eliannys.com/product/manilla-metal"), "manilla-metal");
assert.equal(slugFromUrl("https://eliannys.com/shop"), null);

assert.equal(buildProductsQuery({}), "");
assert.equal(buildProductsQuery({ q: "manilla", in_stock: true }), "?q=manilla&in_stock=true");
assert.equal(buildProductsQuery({ q: "", limit: 5 }), "?limit=5");
assert.match(formatPrice(100000), /\$.*COP/);
assert.equal(copToCents(50000), 5000000);
assert.ok(getCollectionsSync().some((c) => c.slug === "manillas-hombres"));

const card = renderMessage("57300", {
  type: "product_card",
  imageUrl: "http://x/i.png",
  title: "Manilla",
  subtitle: "$31.900",
  url: "http://x/p",
  button: "Ver",
}) as { interactive: { type: string; header: { type: string }; action: { parameters: { url: string } } } };
assert.equal(card.interactive.type, "cta_url");
assert.equal(card.interactive.header.type, "image");
assert.equal(card.interactive.action.parameters.url, "http://x/p");

const btns = renderMessage("57300", {
  type: "buttons",
  text: "elige",
  buttons: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
    { id: "d", title: "D" },
  ],
}) as { interactive: { action: { buttons: unknown[] } } };
assert.equal(btns.interactive.action.buttons.length, 3);

const linkMsg = renderMessage("57300", { type: "link", text: "mira", url: "http://x", button: "Ver" }) as {
  interactive: { type: string; action: { parameters: { url: string } } };
};
assert.equal(linkMsg.interactive.type, "cta_url");
assert.equal(linkMsg.interactive.action.parameters.url, "http://x");

assert.match(
  formatProduct({ name: "M", slug: "m", price_cents: 3190000, stock: 2, storable: true, url: "u" } as never),
  /últimas unidades/,
);
assert.doesNotMatch(
  formatProduct({ name: "M", slug: "m", price_cents: 3190000, stock: 0, made_to_order: true, url: "u" } as never),
  /bajo pedido|stock:/,
);
assert.match(
  formatProduct({ name: "M", slug: "m", id: "pid1", price_cents: 1000, stock: 5, storable: true, url: "u" } as never),
  /id: pid1/,
);
assert.deepEqual(buildOrderBody([{ product_id: "p", qty: 2 }]), { items: [{ product_id: "p", qty: 2 }] });
assert.equal((buildOrderBody([{ product_id: "p", qty: 1 }], "a@b.com") as { email?: string }).email, "a@b.com");

assert.equal(verifySignature("body", undefined), false);
assert.equal(seenBefore("dedupe-1"), false);
assert.equal(seenBefore("dedupe-1"), true);
assert.equal(toWaImageUrl("http://x/a.jpg"), "http://x/a.jpg");
assert.match(toWaImageUrl("http://x/a.webp"), /images\.weserv\.nl.*output=jpg/);
assert.equal(coerceOutMessages([{ type: "text", text: "hi" }]).length, 1);
assert.equal(sanitizeMessages([]).length, 1);

console.log("selfcheck ok");
