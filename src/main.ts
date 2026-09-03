import { serve } from "@hono/node-server";
import { app } from "./http/app.js";
import { config } from "./settings/config.js";

serve({ fetch: app.fetch, port: config.http.port }, (info) =>
  console.log(`listening on http://localhost:${info.port}`),
);
