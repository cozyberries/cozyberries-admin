export interface ProductImage {
  url?: string;
  storage_path?: string;
  is_primary?: boolean;
  display_order?: number;
  product_slug?: string;
}

/** Matches the real `product_variants` table schema. */
export interface ProductVariant {
  slug: string;
  product_slug: string;
  size_slug: string;
  color_slug: string;
  price: number;
  stock_quantity: number;
}

export interface RelatedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  images: string[];
}

export interface SimplifiedProduct {
  id: string;
  name: string;
  slug?: string;
  price: number;
  description?: string;
  category?: string;
  images?: string[];
  is_featured?: boolean;
}

/**
 * Admin-facing product shape returned by GET /api/products.
 *
 * The real DB uses `slug` as the primary key (no `id` column).
 * The API normalises this by adding `id = slug` to every response
 * object so the rest of the frontend can keep using `product.id`.
 */
export interface Product {
  /** Alias for `slug` — injected by the API for frontend compatibility. */
  id: string;
  /** Real primary key column in the `products` table. */
  slug: string;
  name: string;
  description?: string;
  price: number;
  care_instructions?: string;
  stock_quantity?: number;
  is_featured?: boolean;
  is_active?: boolean;
  /** References `categories.slug`. */
  category_slug?: string;
  gender_slug?: string;
  size_slugs?: string[];
  color_slugs?: string[];
  created_at: string;
  updated_at?: string;
  /** Injected from the `categories` join. */
  categories?: { name: string; slug: string };
  /** Flattened from the `product_images` join (primary image first). */
  images?: string[];
  /** Joined from `product_variants`. */
  variants?: ProductVariant[];
}

export interface ProductCreate {
  name: string;
  description?: string;
  price: number;
  stock_quantity?: number;
  is_featured?: boolean;
  category_slug?: string;
  images?: string[];
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  price?: number;
  category_slug?: string;
  stock_quantity?: number;
  is_featured?: boolean;
  is_active?: boolean;
  images?: string[];
}

export interface CategoryImage {
  id: string;
  storage_path: string;
  is_primary?: boolean;
  display_order?: number;
  metadata?: Record<string, unknown>;
  url?: string;
}

export interface Category {
  name: string;
  slug: string;
  description?: string;
  image?: string;
}
