import type { Product } from "./types.js";

// price_cents: se asume COP en centavos (÷100). Confirmar unidad con una llamada real; cambiar aquí si es COP crudo.
export function formatPrice(cents: number): string {
  const cop = Math.round(cents / 100);
  return `$${cop.toLocaleString("es-CO")} COP`;
}

export function formatProduct(p: Product): string {
  const price = p.sale_price_cents != null ? formatPrice(p.sale_price_cents) : formatPrice(p.price_cents);
  const availability =
    p.stock > 0
      ? `stock: ${p.stock}`
      : p.made_to_order
        ? `bajo pedido${p.production_days ? ` (~${p.production_days} días)` : ""}`
        : "agotado";
  return `- ${p.name} (slug: ${p.slug}) — ${price} — ${availability}\n  url: ${p.url}\n  img: ${p.image_url ?? ""}`;
}
