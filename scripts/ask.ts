import { invoke } from "../src/agent/index.js";
import { outToText } from "../src/agent/messages.js";

const argv = process.argv.slice(2);
let threadId: string | undefined;
const rest: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--thread") threadId = argv[++i];
  else rest.push(argv[i]);
}

const input = rest.join(" ").trim();
if (!input) {
  console.error('usage: pnpm ask [--thread <id>] "<message>"');
  process.exit(1);
}

const result = await invoke(input, threadId);
for (const m of result.messages) console.log(`[${m.type}] ${outToText(m)}\n`);
console.error(`(iterations: ${result.iterations}, conversion: ${JSON.stringify(result.conversion)})`);
