import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { getDB } from "./d1.js";
import { D1Saver } from "./d1-saver.js";

let cached: Promise<BaseCheckpointSaver> | null = null;

async function build(): Promise<BaseCheckpointSaver> {
  const db = await getDB();
  return db ? new D1Saver(db) : new MemorySaver();
}

export function getCheckpointer(): Promise<BaseCheckpointSaver> {
  return (cached ??= build());
}
