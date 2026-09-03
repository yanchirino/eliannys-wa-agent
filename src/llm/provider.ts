import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatDeepSeek } from "@langchain/deepseek";
import { config, type Provider } from "../settings/config.js";

async function load<T>(pkg: string, provider: string): Promise<T> {
  try {
    return (await import(pkg)) as T;
  } catch {
    throw new Error(`Provider "${provider}" needs "${pkg}". Install it: pnpm add ${pkg}`);
  }
}

export async function makeModel(provider: Provider = config.llm.provider): Promise<BaseChatModel> {
  const { apiKeys, models } = config.llm;
  switch (provider) {
    case "deepseek": {
      if (!apiKeys.deepseek) throw new Error("Missing DEEPSEEK_API_KEY. Set it in .env before starting.");
      return new ChatDeepSeek({ apiKey: apiKeys.deepseek, model: models.deepseek });
    }
    case "openai": {
      if (!apiKeys.openai) throw new Error("Missing OPENAI_API_KEY. Set it in .env before starting.");
      const { ChatOpenAI } = await load<{ ChatOpenAI: new (o: object) => BaseChatModel }>("@langchain/openai", provider);
      return new ChatOpenAI({ apiKey: apiKeys.openai, model: models.openai });
    }
    case "anthropic": {
      if (!apiKeys.anthropic) throw new Error("Missing ANTHROPIC_API_KEY. Set it in .env before starting.");
      const { ChatAnthropic } = await load<{ ChatAnthropic: new (o: object) => BaseChatModel }>("@langchain/anthropic", provider);
      return new ChatAnthropic({ apiKey: apiKeys.anthropic, model: models.anthropic });
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider as string}".`);
  }
}
