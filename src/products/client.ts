import { config } from "../settings/config.js";
import type { Product, ProductSearchParams, ProductSearchResult } from "./types.js";

const TIMEOUT_MS = 8000;

export const copToCents = (cop: number): number => Math.round(cop * 100);

export function buildProductsQuery(params: ProductSearchParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function apiGet(path: string): Promise<unknown> {
  const { baseUrl, key } = config.shop.api;
  if (!key) throw new Error("SHOP_API_KEY not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`products API ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickArray(body: unknown): Product[] {
  const b = (body ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(body) ? body : (b.data ?? b.products ?? b.items ?? b.results);
  return Array.isArray(arr) ? (arr as Product[]) : [];
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
  const body = await apiGet(`/products${buildProductsQuery(params)}`);
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    products: pickArray(body),
    next_cursor: (b.next_cursor as string | null) ?? null,
    has_more: Boolean(b.has_more),
  };
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  const body = await apiGet(`/products/${encodeURIComponent(idOrSlug)}`);
  const b = (body ?? {}) as Record<string, unknown>;
  const p = (b.data ?? body) as Product;
  return p && (p.slug || p.name) ? p : null;
}
