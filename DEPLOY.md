# Deploy en Cloudflare (Workers)

Target: **Cloudflare Workers** (Hono ✓, D1 ✓, LangGraph.js ✓ con `nodejs_compat`).
Alternativa: **Cloudflare Containers** correría el app Node tal cual (sin migración) — más simple pero menos nativo/edge; esta guía asume Workers.

## Adaptaciones de código requeridas (pendientes)

El app hoy corre en Node (tsx + `@hono/node-server`). Para Workers falta:

1. **Entry Workers** `src/worker.ts`: `export default app` (Hono es Workers-native). `src/main.ts` (node-server) queda solo para Node local.
2. **Webhook con `ctx.waitUntil`**: hoy el handler responde 200 y procesa fire-and-forget. En Workers eso se mata tras el 200 → envolver `c.executionCtx.waitUntil(handleInbound(...))`.
3. **Prompts sin filesystem**: `loader.ts` usa `readFileSync` → no existe fs en Workers. Bundlear los `.md` como texto (regla `rules` type `Text` en wrangler, o inline). El loader debe ramificar (fs en Node / import en Workers) o usar imports siempre.
4. **Binding D1 por `env`**: en Workers `env.DB` viene del runtime (via `c.env.DB`), no de `getPlatformProxy` (que es solo dev). Hay que pasar el binding al checkpointer.
5. **Memoria = D1** (`USE_D1=1`): los isolates de Workers son efímeros → `MemorySaver` no persiste entre requests; usar `D1Saver`.

> `compatibility_date ≥ 2025-04-01` + `nodejs_compat` → `process.env` se puebla con vars/secrets, así el resto de `config.ts` funciona sin cambios.

## wrangler.toml (Worker)

```toml
name = "eliannys-wa-agent"
main = "src/worker.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

# webhook en dominio propio (requiere eliannys.com en Cloudflare)
routes = [{ pattern = "chat.eliannys.com", custom_domain = true }]

# prompts como módulos de texto (si se bundlean por import)
rules = [{ type = "Text", globs = ["prompts/**/*.md"] }]

[[d1_databases]]
binding = "DB"
database_name = "eliannys-wa-agent"
database_id = "b6b6d8a9-ddc4-4dc5-9487-8987e0afd297"
migrations_dir = "migrations"

[vars]
LLM_PROVIDER = "deepseek"
GRAPH_API_VERSION = "v26.0"
SHOP_API_BASE_URL = "https://eliannys.com/api/v1"
USE_D1 = "1"
```

## Secrets (no van en el toml)

```
wrangler secret put DEEPSEEK_API_KEY
wrangler secret put SHOP_API_KEY
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put WHATSAPP_APP_SECRET
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID
wrangler secret put AGENT_TOKEN
```
Local (Workers runtime): los mismos en `.dev.vars` (formato `CLAVE=valor`, ya ignorado por git).

## Pasos

```
# 1. D1 (una vez)
wrangler d1 create eliannys-wa-agent          # copia el database_id al wrangler.toml
wrangler d1 migrations apply eliannys-wa-agent --remote

# 2. Secrets (arriba)

# 3. Local en runtime Workers
wrangler dev                                # usa .dev.vars

# 4. Deploy
wrangler deploy                             # → https://chat.eliannys.com (custom domain)
```

## Webhook en Meta

```
Callback URL:  https://chat.eliannys.com/webhook
Verify token:  el valor de WHATSAPP_VERIFY_TOKEN
Campos:        messages
```

## Gotchas

- El proxy de imágenes (`images.weserv.nl`) funciona igual desde Workers (subrequest saliente).
- Reactivo (ventana 24h): sin templates.
- Subrequests por mensaje (~15-20: LLM + API producto + envíos WA) < límite de Workers.
- LangGraph espera los writes del checkpointer antes de resolver `invoke()`, así que la persistencia no necesita `waitUntil`; el `waitUntil` es solo para no cortar el procesamiento del webhook tras el 200.
```
