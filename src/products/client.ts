import { randomUUID } from "node:crypto";
import { config } from "../settings/config.js";
import type { OrderItem, OrderResult, Product, ProductSearchParams, ProductSearchResult } from "./types.js";

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

export function buildOrderBody(items: OrderItem[], email?: string): Record<string, unknown> {
  return { items, ...(email ? { email } : {}) };
}

export async function createOrder(items: OrderItem[], email?: string): Promise<OrderResult> {
  const { baseUrl, key } = config.shop.api;
  if (!key) throw new Error("SHOP_API_KEY not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(buildOrderBody(items, email)),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`orders API ${res.status}`);
    const body = (await res.json()) as { data?: OrderResult };
    return (body?.data ?? body) as OrderResult;
  } finally {
    clearTimeout(timer);
  }
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  const body = await apiGet(`/products/${encodeURIComponent(idOrSlug)}`);
  const b = (body ?? {}) as Record<string, unknown>;
  const p = (b.data ?? body) as Product;
  return p && (p.slug || p.name) ? p : null;
}
