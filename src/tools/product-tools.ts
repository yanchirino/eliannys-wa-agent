import { z } from "zod";
import type { Tool } from "./types.js";
import { registerTool } from "./registry.js";
import { config } from "../settings/config.js";
import { searchProducts, getProduct, copToCents, createOrder } from "../products/client.js";
import { formatProduct, formatPrice } from "../products/format.js";
import { getCollectionsSync } from "../products/collections.js";

const OFFLINE = "No pude consultar el catálogo ahora; invita a ver https://eliannys.com/shop.";

const searchSchema = z.object({
  q: z.string().optional(),
  collection: z.string().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(20).optional(),
});

const searchProductsTool: Tool<z.infer<typeof searchSchema>> = {
  name: "searchProducts",
  description:
    "Busca productos de la tienda (nombre, precio, stock, link, slug). Precio en COP. Para filtrar por línea usa `collection` con el slug exacto de la lista de colecciones del contexto. Úsalo para recomendar piezas concretas.",
  schema: searchSchema,
  run: async ({ min_price, max_price, ...rest }) => {
    try {
      const { products } = await searchProducts({
        limit: 5,
        ...rest,
        ...(min_price != null ? { min_price: copToCents(min_price) } : {}),
        ...(max_price != null ? { max_price: copToCents(max_price) } : {}),
      });
      if (!products.length) return "Sin resultados para esa búsqueda.";
      return products.slice(0, 5).map(formatProduct).join("\n");
    } catch {
      return OFFLINE;
    }
  },
};

const getProductTool: Tool<{ idOrSlug: string }> = {
  name: "getProduct",
  description: "Obtiene el detalle de un producto por id o slug.",
  schema: z.object({ idOrSlug: z.string() }),
  run: async ({ idOrSlug }) => {
    try {
      const p = await getProduct(idOrSlug);
      return p ? formatProduct(p) : "Producto no encontrado.";
    } catch {
      return OFFLINE;
    }
  },
};

const createOrderTool: Tool<{ items: { product_id: string; qty: number }[]; email?: string }> = {
  name: "createOrder",
  description:
    "Crea la orden y devuelve el link de pago (pay_url). Úsalo SOLO cuando la clienta confirma qué producto(s) comprar. `product_id` debe venir de searchProducts/getProduct; nunca lo inventes.",
  schema: z.object({
    items: z.array(z.object({ product_id: z.string(), qty: z.number().int().min(1) })).min(1),
    email: z.string().email().optional(),
  }),
  run: async ({ items, email }) => {
    try {
      const o = await createOrder(items, email);
      if (!o?.pay_url) return "No se pudo generar el link de pago; invita a https://eliannys.com/shop.";
      const total = o.total_cents != null ? ` Total: ${formatPrice(o.total_cents)}.` : "";
      return `Orden creada.${total} Link de pago (pay_url): ${o.pay_url}`;
    } catch {
      return "No pude crear la orden ahora; invita a https://eliannys.com/shop.";
    }
  },
};

const listCollectionsTool: Tool<Record<string, never>> = {
  name: "listCollections",
  description: "Lista las colecciones de la tienda con su nombre y link real (url).",
  schema: z.object({}),
  run: async () => {
    const cols = getCollectionsSync();
    return cols.map((c) => `${c.name}: ${c.url}`).join("\n");
  },
};

export function registerProductTools(): void {
  if (!config.shop.api.key) return;
  registerTool(searchProductsTool);
  registerTool(getProductTool);
  registerTool(createOrderTool);
  registerTool(listCollectionsTool);
}
