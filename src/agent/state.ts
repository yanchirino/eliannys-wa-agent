import { Annotation } from "@langchain/langgraph";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { OutMessage } from "./messages.js";

export interface Conversion {
  recommendedProduct: boolean;
  sentLink: boolean;
  purchaseIntent: boolean;
}

export interface ShownProduct {
  id?: string;
  name: string;
  slug: string;
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
  shownProducts: Annotation<ShownProduct[]>({
    reducer: (a, b) => {
      const map = new Map(a.map((p) => [p.slug, p]));
      for (const p of b) map.set(p.slug, p);
      return [...map.values()].slice(-8);
    },
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
