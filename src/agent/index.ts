import { randomUUID } from "node:crypto";
import { graph } from "./graph.js";
import { getCheckpointer } from "../memory/checkpointer.js";
import { registerProductTools } from "../tools/product-tools.js";
import { warmCollections } from "../products/collections.js";
import type { Conversion } from "./state.js";
import type { OutMessage } from "./messages.js";

registerProductTools();

let warmed = false;
function ensureWarm(): void {
  if (warmed) return;
  warmed = true;
  void warmCollections();
}

let appPromise: ReturnType<typeof compileApp> | null = null;
async function compileApp() {
  return graph.compile({ checkpointer: await getCheckpointer() });
}
function getApp() {
  return (appPromise ??= compileApp());
}

const NO_CONVERSION: Conversion = { recommendedProduct: false, sentLink: false, purchaseIntent: false };

export async function invoke(
  input: string,
  threadId?: string,
): Promise<{ messages: OutMessage[]; conversion: Conversion; iterations: number }> {
  ensureWarm();
  const app = await getApp();
  const out = await app.invoke(
    { input },
    { configurable: { thread_id: threadId ?? randomUUID() }, recursionLimit: 60 },
  );
  return {
    messages: out.outMessages ?? [],
    conversion: out.conversion ?? NO_CONVERSION,
    iterations: out.iterations ?? 0,
  };
}
