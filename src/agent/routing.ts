import { config } from "../settings/config.js";
import type { AgentState } from "./state.js";

export function routeAfterDraft(state: AgentState): "tools" | "reflect" {
  const wantsTools = (state.lastMessage?.tool_calls?.length ?? 0) > 0;
  return wantsTools && (state.toolTurns ?? 0) < config.agent.maxToolTurns ? "tools" : "reflect";
}

export function routeAfterCritique(state: AgentState): "generate" | "compose" {
  return state.shouldRefine && (state.iterations ?? 0) < config.agent.maxIterations ? "generate" : "compose";
}
