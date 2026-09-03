import { StateGraph, START, END } from "@langchain/langgraph";
import { StateAnnotation } from "./state.js";
import { analyze, generate, toolsNode, reflect, compose, respond } from "./nodes.js";
import { routeAfterDraft, routeAfterCritique } from "./routing.js";

export const graph = new StateGraph(StateAnnotation)
  .addNode("analyze", analyze)
  .addNode("generate", generate)
  .addNode("tools", toolsNode)
  .addNode("reflect", reflect)
  .addNode("compose", compose)
  .addNode("respond", respond)
  .addEdge(START, "analyze")
  .addEdge("analyze", "generate")
  .addConditionalEdges("generate", routeAfterDraft, { tools: "tools", reflect: "reflect" })
  .addEdge("tools", "generate")
  .addConditionalEdges("reflect", routeAfterCritique, { generate: "generate", compose: "compose" })
  .addEdge("compose", "respond")
  .addEdge("respond", END);
