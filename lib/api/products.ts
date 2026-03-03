/**
 * Canonical size rank used to sort product variants in human size order.
 * Unknown slugs fall back to Infinity so they sort last.
 */
const SIZE_ORDER: Record<string, number> = {
  "newborn": 0,
  "nb": 0,
  "0-1m": 1,
  "0-3m": 2,
  "3-6m": 3,
  "6-9m": 4,
  "6-12m": 5,
  "9-12m": 6,
  "12-18m": 7,
  "18-24m": 8,
  "1-2y": 9,
  "2-3y": 10,
  "3-4y": 11,
  "4-5y": 12,
  "5-6y": 13,
  "6-7y": 14,
  "7-8y": 15,
  "8-9y": 16,
  "9-10y": 17,
  "10-11y": 18,
  "11-12y": 19,
  "12-13y": 20,
  "13-14y": 21,
  "xs": 22,
  "s": 23,
  "m": 24,
  "l": 25,
  "xl": 26,
  "xxl": 27,
  "2xl": 27,
  "xxxl": 28,
  "3xl": 28,
};

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

  const variants = (p.product_variants ?? []).sort((a, b) => {
    const rankA = SIZE_ORDER[a.size_slug.toLowerCase()] ?? Infinity;
    const rankB = SIZE_ORDER[b.size_slug.toLowerCase()] ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    const bySize = a.size_slug.localeCompare(b.size_slug);
    if (bySize !== 0) return bySize;
    const colorA = (a.color_slug ?? "").toLowerCase();
    const colorB = (b.color_slug ?? "").toLowerCase();
    return colorA.localeCompare(colorB);
  });

  return {
    ...p,
    id: p.slug,
    images,
    variants,
    product_images: undefined,
    product_variants: undefined,
  };
}
