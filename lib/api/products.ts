export type RawProduct = {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  care_instructions?: string | null;
  stock_quantity?: number | null;
  is_featured?: boolean;
  is_active?: boolean;
  category_slug?: string | null;
  gender_slug?: string | null;
  size_slugs?: string[];
  color_slugs?: string[];
  created_at: string;
  updated_at?: string;
  categories?: { name: string; slug: string } | null;
  product_images?: { url: string; is_primary: boolean; display_order: number | null }[];
  product_variants?: {
    slug: string;
    product_slug: string;
    size_slug: string;
    color_slug: string;
    price: number;
    stock_quantity: number;
  }[];
};

export function normaliseProduct(p: RawProduct) {
  const images = (p.product_images ?? [])
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    })
    .map((img) => img.url)
    .filter(Boolean);

  const variants = (p.product_variants ?? []).sort((a, b) =>
    a.size_slug.localeCompare(b.size_slug)
  );

  return {
    ...p,
    id: p.slug,
    images,
    variants,
    product_images: undefined,
    product_variants: undefined,
  };
}
