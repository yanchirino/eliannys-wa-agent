import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import type { AgentState } from "./state.js";
import { run } from "../llm/query-engine.js";
import { loadPrompt } from "../prompts/loader.js";
import { tools } from "../tools/registry.js";
import { executeToolCall } from "../tools/execute.js";
import { extractJson } from "../shared/json.js";
import { commercialSystem, textOf, normalizeConversion } from "./context.js";
import { coerceOutMessages, sanitizeMessages, outToText, slugFromUrl, productIdBySlug } from "./messages.js";

export async function analyze(state: AgentState) {
  const convo = [...(state.messages ?? []), new HumanMessage(state.input)];
  const { message } = await run([
    new SystemMessage(loadPrompt("system")),
    ...convo,
    new HumanMessage(
      `${loadPrompt("analyze")}\n\nDevuelve SOLO JSON: ` +
        `{"plan": "<plan breve>", "customerName": "<nombre o null>", "activeLine": "<línea/tema activo o null>"}`,
    ),
  ]);
  const parsed = extractJson<{ plan?: string; customerName?: string | null; activeLine?: string | null }>(
    textOf(message),
  );

  const out: Partial<AgentState> = {
    plan: parsed?.plan ?? textOf(message),
    messages: [new HumanMessage(state.input)],
    candidate: [],
    fixes: [],
    iterations: 0,
    toolTurns: 0,
    toolResults: [],
    lastMessage: null,
    composed: [],
  };
  const name = parsed?.customerName;
  if (typeof name === "string" && name.trim() && name.trim().toLowerCase() !== "null") {
    out.customerName = name.trim();
  }
  const line = parsed?.activeLine;
  if (typeof line === "string" && line.trim() && line.trim().toLowerCase() !== "null") {
    out.activeLine = line.trim();
  }
  return out;
}

export async function generate(state: AgentState) {
  const fixes = state.fixes ?? [];
  const toolResults = state.toolResults ?? [];
  const shown = state.shownSlugs ?? [];
  const shownP = state.shownProducts ?? [];
  const guidance = [
    state.customerName ? `Cliente: ${state.customerName} (tutéale por su nombre con naturalidad).` : "",
    state.activeLine ? `Línea/tema activo en la conversación: ${state.activeLine}. Resuelve "denuevo/esa/la" contra esto.` : "",
    shown.length ? `Productos YA mostrados (no los repitas; si pide "otro", muestra uno distinto): ${shown.join(", ")}.` : "",
    shownP.length
      ? `Piezas mostradas y su referencia (si pide "ese/uno de esos/quiero ese", resuélvelo a esta pieza y ordénala con createOrder por su id, sin re-buscar): ${shownP.map((p) => `${p.name}${p.id ? ` (id: ${p.id})` : ` (slug: ${p.slug})`}`).join("; ")}.`
      : "",
    state.plan ? `Análisis:\n${state.plan}` : "",
    fixes.length ? `Corrige estos puntos de tu versión anterior:\n- ${fixes.join("\n- ")}` : "",
    toolResults.length ? `Resultados de herramientas:\n${toolResults.join("\n")}` : "",
    "Escribe el contenido de la respuesta (qué decir), breve y cercano. No repreguntes lo ya definido en el hilo.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { message } = await run(
    [commercialSystem(), ...(state.messages ?? []), new HumanMessage(guidance)],
    { tools },
  );
  const parsed = extractJson<{ messages?: unknown }>(textOf(message));
  let candidate: string[] = Array.isArray(parsed?.messages)
    ? (parsed!.messages.filter((m) => typeof m === "string" && m.trim()) as string[]).slice(0, 2)
    : [];
  if (!candidate.length) candidate = [textOf(message)];
  return { candidate, lastMessage: message };
}

export async function toolsNode(state: AgentState) {
  const calls = state.lastMessage?.tool_calls ?? [];
  const results: string[] = [];
  for (const call of calls) results.push(`${call.name}: ${await executeToolCall(call.name, call.args)}`);
  return { toolResults: [...(state.toolResults ?? []), ...results], toolTurns: (state.toolTurns ?? 0) + 1 };
}

export async function reflect(state: AgentState) {
  const draft = (state.candidate ?? []).join("\n---\n");
  const { message } = await run([
    commercialSystem(),
    new HumanMessage(
      `${loadPrompt("critique")}\n\nEntrada del cliente:\n${state.input}\n\nBorrador (contenido):\n${draft}\n\n` +
        `Devuelve SOLO JSON: {"ready": <bool>, "fixes": ["<qué corregir>"], ` +
        `"conversion": {"recommendedProduct": <bool>, "sentLink": <bool>, "purchaseIntent": <bool>}}`,
    ),
  ]);
  const v = extractJson<{ ready?: unknown; fixes?: unknown; conversion?: unknown }>(textOf(message));
  const ready = v ? Boolean(v.ready) : true;
  const fixes = v && Array.isArray(v.fixes) ? (v.fixes.filter((x) => typeof x === "string") as string[]) : [];
  return {
    shouldRefine: !ready,
    fixes,
    conversion: normalizeConversion(v?.conversion),
    iterations: (state.iterations ?? 0) + 1,
  };
}

export async function compose(state: AgentState) {
  const content = (state.candidate ?? []).join("\n");
  const toolResults = state.toolResults ?? [];
  const shown = state.shownSlugs ?? [];
  const guidance = [
    `Respuesta a formatear para WhatsApp:\n${content}`,
    toolResults.length ? `Datos de productos disponibles (usa url e img para fichas):\n${toolResults.join("\n")}` : "",
    shown.length ? `Ya mostrados (no repitas estos en fichas): ${shown.join(", ")}.` : "",
    'Decide el mejor formato y devuelve SOLO JSON {"messages": [...]}.',
  ]
    .filter(Boolean)
    .join("\n\n");
  const { message } = await run([new SystemMessage(loadPrompt("compose")), new HumanMessage(guidance)]);
  const parsed = extractJson<{ messages?: unknown }>(textOf(message));
  return { composed: coerceOutMessages(parsed?.messages) };
}

export function respond(state: AgentState) {
  const out = sanitizeMessages(state.composed ?? []);
  const joined = out.map(outToText).join("\n\n");
  const idBySlug = productIdBySlug(state.toolResults ?? []);
  const shownProducts = out.flatMap((m) => {
    if (m.type !== "product_card") return [];
    const slug = slugFromUrl(m.url);
    if (!slug) return [];
    const id = idBySlug.get(slug);
    return [{ slug, name: m.title, ...(id ? { id } : {}) }];
  });
  const newSlugs = shownProducts.map((p) => p.slug);
  return { outMessages: out, messages: [new AIMessage(joined)], shownSlugs: newSlugs, shownProducts };
}
