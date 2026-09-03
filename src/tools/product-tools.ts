import { z } from "zod";
import type { Tool } from "./types.js";
import { registerTool } from "./registry.js";
import { config } from "../settings/config.js";
import { searchProducts, getProduct, copToCents } from "../products/client.js";
import { formatProduct } from "../products/format.js";

const OFFLINE = "No pude consultar el catálogo ahora; invita a ver https://eliannys.com/shop.";

const searchSchema = z.object({
  q: z.string().optional(),
  collection: z.string().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  in_stock: z.boolean().optional(),
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

export function registerProductTools(): void {
  if (!config.shop.api.key) return;
  registerTool(searchProductsTool);
  registerTool(getProductTool);
}
