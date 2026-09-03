import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { tool as lcTool } from "@langchain/core/tools";
import { config } from "../settings/config.js";
import { makeModel } from "./provider.js";
import type { Tool } from "../tools/types.js";

const MAX_RETRIES = config.queryEngine.maxRetries;

let modelPromise: Promise<BaseChatModel> | null = null;
function getModel(): Promise<BaseChatModel> {
  return (modelPromise ??= makeModel());
}

export function isTransient(err: unknown): boolean {
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  if (typeof status === "number" && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /rate limit|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network|overloaded/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isTransient(err)) break;
      await sleep(2 ** attempt * 250);
    }
  }
  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`query-engine: model call failed after ${MAX_RETRIES + 1} attempt(s): ${detail}`);
}

function bind(model: BaseChatModel, tools?: Tool[]) {
  if (!tools?.length || typeof model.bindTools !== "function") return model;
  return model.bindTools(
    tools.map((t) =>
      lcTool(async (a: unknown) => String(await t.run(a as never)), {
        name: t.name,
        description: t.description,
        schema: t.schema,
      }),
    ),
  );
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export async function run(
  messages: BaseMessage[],
  opts?: { tools?: Tool[] },
): Promise<{ message: AIMessage; usage: Usage }> {
  const model = await getModel();
  const message = (await withRetry(() => bind(model, opts?.tools).invoke(messages))) as AIMessage;
  const u = message.usage_metadata;
  return {
    message,
    usage: { inputTokens: u?.input_tokens, outputTokens: u?.output_tokens, totalTokens: u?.total_tokens },
  };
}

export async function* stream(messages: BaseMessage[], opts?: { tools?: Tool[] }): AsyncGenerator<string, string> {
  const model = await getModel();
  const chunks = await bind(model, opts?.tools).stream(messages);
  let full = "";
  for await (const chunk of chunks) {
    const text = typeof chunk.content === "string" ? chunk.content : "";
    full += text;
    if (text) yield text;
  }
  return full;
}
