import { serve } from "@hono/node-server";
import { app } from "./http/app.js";
import { config } from "./settings/config.js";
import { setD1Binding } from "./memory/d1.js";

if (config.memory.useD1) {
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy();
  setD1Binding((proxy.env as Record<string, unknown>).DB);
}

serve({ fetch: app.fetch, port: config.http.port }, (info) =>
  console.log(`listening on http://localhost:${info.port}`),
);
