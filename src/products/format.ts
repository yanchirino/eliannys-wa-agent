import type { Product } from "./types.js";

// price_cents: se asume COP en centavos (÷100). Confirmar unidad con una llamada real; cambiar aquí si es COP crudo.
export function formatPrice(cents: number): string {
  const cop = Math.round(cents / 100);
  return `$${cop.toLocaleString("es-CO")} COP`;
}

export function formatProduct(p: Product): string {
  const price = p.sale_price_cents != null ? formatPrice(p.sale_price_cents) : formatPrice(p.price_cents);
  // Solo se menciona disponibilidad si es artículo con stock real: agotado, o "últimas unidades" (<3).
  // Los fabricados (made_to_order) no llevan nota; nunca se dice "bajo pedido" ni cantidades exactas.
  let availability = "";
  if (p.storable) {
    if (p.stock <= 0) availability = "agotado";
    else if (p.stock < 3) availability = "últimas unidades";
  }
  const av = availability ? ` — ${availability}` : "";
  return `- ${p.name} (id: ${p.id}, slug: ${p.slug}) — ${price}${av}\n  url: ${p.url}\n  img: ${p.image_url ?? ""}`;
}
