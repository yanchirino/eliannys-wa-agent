import { config } from "../settings/config.js";

export interface Collection {
  slug: string;
  name: string;
}

const FALLBACK: Collection[] = [
  { slug: "earcuff", name: "Ear cuffs" },
  { slug: "manillas", name: "Manillas" },
  { slug: "candongas", name: "Candongas" },
  { slug: "manillas-hombres", name: "Hombres" },
  { slug: "collares", name: "Collares" },
  { slug: "manillas-parejas-amistad", name: "Amor y amistad" },
];

let cache: Collection[] | null = null;

export function getCollectionsSync(): Collection[] {
  return cache ?? FALLBACK;
}

export async function warmCollections(): Promise<void> {
  const { baseUrl, key } = config.shop.api;
  if (!key) return;
  try {
    const res = await fetch(`${baseUrl}/collections`, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    });
    if (!res.ok) return;
    const body = (await res.json()) as unknown;
    const b = (body ?? {}) as Record<string, unknown>;
    const arr = Array.isArray(body) ? body : (b.data ?? b.results ?? b.items ?? []);
    const cols = (Array.isArray(arr) ? arr : [])
      .map((c) => {
        const o = c as Record<string, unknown>;
        return { slug: String(o.slug ?? o.id ?? ""), name: String(o.name ?? o.slug ?? "") };
      })
      .filter((c) => c.slug);
    if (cols.length) cache = cols;
  } catch {
    // keep fallback
  }
}
