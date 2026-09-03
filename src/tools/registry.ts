import type { Tool } from "./types.js";

export const tools: Tool[] = [];

export function registerTool<I, O>(tool: Tool<I, O>): void {
  tools.push(tool as Tool);
}

export function getTool(name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}
