import { app } from "./http/app.js";
import { setD1Binding } from "./memory/d1.js";
import { setPromptBundle } from "./prompts/loader.js";
import system from "../prompts/system.md";
import analyze from "../prompts/analyze.md";
import critique from "../prompts/critique.md";
import compose from "../prompts/compose.md";
import empresa from "../prompts/empresa.md";

setPromptBundle({ system, analyze, critique, compose, empresa });

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  fetch(request: Request, env: { DB?: unknown }, ctx: ExecutionContext): Response | Promise<Response> {
    setD1Binding(env.DB);
    return app.fetch(request, env, ctx as Parameters<typeof app.fetch>[2]);
  },
};
