import { config } from "../settings/config.js";

export interface Collection {
  slug: string;
  name: string;
  url: string;
  image_url?: string;
}

const SHOP = "https://eliannys.com/shop";
const FALLBACK: Collection[] = [
  { slug: "earcuff", name: "Ear cuffs", url: SHOP },
  { slug: "manillas", name: "Manillas", url: SHOP },
  { slug: "candongas", name: "Candongas", url: SHOP },
  { slug: "manillas-hombres", name: "Hombres", url: SHOP },
  { slug: "collares", name: "Collares", url: SHOP },
  { slug: "manillas-parejas-amistad", name: "Amor y amistad", url: SHOP },
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
        const slug = String(o.slug ?? o.id ?? "");
        return {
          slug,
          name: String(o.name ?? o.slug ?? ""),
          url: String(o.url ?? SHOP),
          image_url: o.image_url ? String(o.image_url) : undefined,
        };
      })
      .filter((c) => c.slug);
    if (cols.length) cache = cols;
  } catch {
    // keep fallback
  }
}
