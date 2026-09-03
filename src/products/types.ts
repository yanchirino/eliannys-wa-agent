export interface Product {
  id: string | number;
  slug: string;
  name: string;
  description?: string;
  sku?: string;
  price_cents: number;
  sale_price_cents?: number | null;
  stock: number;
  production_days?: number;
  made_to_order?: boolean;
  free_shipping?: boolean;
  url: string;
  image_url?: string;
}

export interface ProductSearchParams {
  q?: string;
  suggest?: boolean;
  category?: string;
  collection?: string;
  tag?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  featured?: boolean;
  sort?: string;
  limit?: number;
  cursor?: string;
}

export interface ProductSearchResult {
  products: Product[];
  next_cursor?: string | null;
  has_more?: boolean;
}
