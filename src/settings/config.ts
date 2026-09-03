import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const Env = z.object({
  LLM_PROVIDER: z.enum(["deepseek", "openai", "anthropic"]).default("deepseek"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-latest"),
  MAX_ITERATIONS: z.coerce.number().int().positive().default(3),
  MAX_TOOL_TURNS: z.coerce.number().int().positive().default(8),
  QUERY_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  USE_D1: z.enum(["0", "1"]).default("1"),
  PORT: z.coerce.number().int().positive().default(3000),
  SHOP_BASE_URL: z.string().url().default("https://eliannys.com"),
  SHOP_API_BASE_URL: z.string().url().default("https://eliannys.com/api/v1"),
  SHOP_API_KEY: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  GRAPH_API_VERSION: z.string().default("v26.0"),
  AGENT_TOKEN: z.string().optional(),
});

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
  throw new Error(`Invalid configuration:\n${issues}`);
}
const e = parsed.data;

export const config = Object.freeze({
  llm: {
    provider: e.LLM_PROVIDER,
    apiKeys: { deepseek: e.DEEPSEEK_API_KEY, openai: e.OPENAI_API_KEY, anthropic: e.ANTHROPIC_API_KEY },
    models: { deepseek: e.DEEPSEEK_MODEL, openai: e.OPENAI_MODEL, anthropic: e.ANTHROPIC_MODEL },
  },
  agent: { maxIterations: e.MAX_ITERATIONS, maxToolTurns: e.MAX_TOOL_TURNS },
  queryEngine: { maxRetries: e.QUERY_MAX_RETRIES },
  memory: { useD1: e.USE_D1 === "1" },
  http: { port: e.PORT },
  shop: {
    baseUrl: e.SHOP_BASE_URL,
    api: { baseUrl: e.SHOP_API_BASE_URL, key: e.SHOP_API_KEY },
  },
  prompts: { dir: join(root, "prompts") },
  whatsapp: {
    verifyToken: e.WHATSAPP_VERIFY_TOKEN,
    appSecret: e.WHATSAPP_APP_SECRET,
    token: e.WHATSAPP_TOKEN,
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: e.GRAPH_API_VERSION,
  },
  agentToken: e.AGENT_TOKEN,
} as const);

export type Config = typeof config;
export type Provider = Config["llm"]["provider"];
