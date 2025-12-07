import { SimplifiedProduct } from "@/lib/services/api";
import { ProductImage, CategoryImage } from "@/lib/types/product";

// ---------- Helper Functions ----------

// Get the primary image URL from product images array
export const getPrimaryImageUrl = (
  images?: ProductImage[]
): string | undefined => {
  if (!images || images.length === 0) {
    return undefined; // Return undefined instead of null when no images
  }

  // Find primary image first
  const primaryImage = images.find((img) => img.is_primary);
  if (primaryImage) {
    return primaryImage.url || `/${primaryImage.storage_path}`;
  }

  // Fall back to first image if no primary
  const firstImage = images[0];
  return firstImage.url || `/${firstImage.storage_path}`;
};

// Get all image URLs from product images array
export const getAllImageUrls = (images?: ProductImage[]): string[] => {
  if (!images || images.length === 0) {
    return []; // Return empty array instead of placeholder when no images
  }

  return images.map((img) => img.url || `/${img.storage_path}`);
};

// Get the primary image URL from category images array
export const getPrimaryCategoryImageUrl = (
  images?: CategoryImage[]
): string | undefined => {
  if (!images || images.length === 0) {
    return undefined; // Return undefined instead of null when no images
  }

  // Find primary image first
  const primaryImage = images.find((img) => img.is_primary);
  if (primaryImage) {
    return primaryImage.url || `/${primaryImage.storage_path}`;
  }

  // Fall back to first image if no primary
  const firstImage = images[0];
  return firstImage.url || `/${firstImage.storage_path}`;
};

// Get all category image URLs from category images array
export const getAllCategoryImageUrls = (images?: CategoryImage[]): string[] => {
  if (!images || images.length === 0) {
    return []; // Return empty array instead of placeholder when no images
  }

  return images.map((img) => img.url || `/${img.storage_path}`);
};

// ---------- Normalizer ----------
export const normalizeProduct = (p: any): SimplifiedProduct => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  price: p.price,
  description: p.description,
  categoryId: p.category_id || "Uncategorized",
  categoryName: p.categories?.name || "Uncategorized",
  image: p.images?.[0] || undefined, // Use first image as primary
  is_featured: p.is_featured || false,
});
