import { Annotation } from "@langchain/langgraph";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { OutMessage } from "./messages.js";

export interface Conversion {
  recommendedProduct: boolean;
  sentLink: boolean;
  purchaseIntent: boolean;
}

export const StateAnnotation = Annotation.Root({
  input: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  customerName: Annotation<string>,
  activeLine: Annotation<string>,
  shownSlugs: Annotation<string[]>({
    reducer: (a, b) => [...new Set([...a, ...b])],
    default: () => [],
  }),
  plan: Annotation<string>,
  candidate: Annotation<string[]>,
  fixes: Annotation<string[]>,
  shouldRefine: Annotation<boolean>,
  iterations: Annotation<number>,
  toolTurns: Annotation<number>,
  composed: Annotation<OutMessage[]>,
  outMessages: Annotation<OutMessage[]>,
  conversion: Annotation<Conversion>,
  lastMessage: Annotation<AIMessage | null>,
  toolResults: Annotation<string[]>,
});

export type AgentState = typeof StateAnnotation.State;
