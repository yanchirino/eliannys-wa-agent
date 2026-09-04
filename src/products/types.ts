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
  storable?: boolean;
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

export interface OrderItem {
  product_id: string;
  qty: number;
}

export interface OrderResult {
  id?: string;
  status?: string;
  subtotal_cents?: number;
  total_cents?: number;
  currency?: string;
  pay_url: string;
}
