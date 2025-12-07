import axios from "axios";
import { normalizeProduct } from "@/lib/utils/product";
// ---------- Types ----------
export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stock_quantity: number;
  size: string;
  color: string;
}

export interface ProductImage {
  id: string;
  storage_path: string;
  is_primary?: boolean;
  display_order?: number;
  url?: string;
}

export interface RelatedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  care_instructions: string;
  stock_quantity: number;
  is_featured: boolean;
  category_id: string;
  category: string;
  categories: { name: string };
  features: string[];
  images: string[];
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
  RelatedProduct?: RelatedProduct[];
}

export interface SimplifiedProduct {
  id: string;
  name: string;
  slug?: string;
  price: number;
  description?: string;
  category?: string;
  categoryId?: string;
  categoryName?: string;
  image?: string;
  is_featured?: boolean;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  products: T[];
  pagination: PaginationInfo;
}

// ---------- Axios Client ----------
// For Next.js API routes, we don't need a baseURL since they're on the same domain
// This completely avoids CORS issues
const api = axios.create({
  headers: { "Content-Type": "application/json" },
  timeout: 15000, // 15 second timeout
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      console.error("Request timeout:", error.config.url);
    } else if (error.response?.status >= 500) {
      console.error("Server error:", error.response.status, error.config.url);
    } else if (!error.response) {
      console.error("Network error or no response:", error.message);
    }
    return Promise.reject(error);
  }
);

// ---------- API Functions ----------
export const getCategories = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await api.get("/api/categories");
      return data || [];
    } catch (error) {
      console.error(
        `Error fetching categories (attempt ${i + 1}/${retries}):`,
        error
      );

      // If it's the last retry, return empty array
      if (i === retries - 1) {
        console.error("Failed to fetch categories after all retries");
        return [];
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  return [];
};

// Note: getAllProducts function removed - use getAllProductsDetailed() and transform with normalizeProduct() instead

export const getFeaturedProducts = async (
  limit = 4,
  retries = 3
): Promise<Product[]> => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await api.get("/api/products", {
        params: {
          limit,
          featured: true,
        },
      });
      // Return full product data
      return data?.products || [];
    } catch (error) {
      console.error(
        `Error fetching featured products (attempt ${i + 1}/${retries}):`,
        error
      );

      // If it's the last retry, return empty array
      if (i === retries - 1) {
        console.error("Failed to fetch featured products after all retries");
        return [];
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  return [];
};

export interface ProductsResponse {
  products: Product[];
  pagination: PaginationInfo;
}

export const getProducts = async (
  params: {
    limit?: number;
    page?: number;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    featured?: boolean;
    search?: string;
  } = {},
  retries = 3
): Promise<{ products: Product[]; pagination: PaginationInfo }> => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await api.get("/api/products", {
        params: {
          limit: params.limit || 12,
          page: params.page || 1,
          category: params.category,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          featured: params.featured,
          search: params.search,
        },
      });
      // Return full product data
      return {
        products: data?.products || [],
        pagination: data?.pagination || {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    } catch (error) {
      console.error(
        `Error fetching products (attempt ${i + 1}/${retries}):`,
        error
      );

      // If it's the last retry, return empty response
      if (i === retries - 1) {
        console.error("Failed to fetch products after all retries");
        return {
          products: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: 12,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  return {
    products: [],
    pagination: {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: 12,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
};

export const getAllProductsDetailed = async (
  retries = 3
): Promise<Product[]> => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await api.get("/api/products", {
        params: {
          limit: 100, // Maximum allowed by API
        },
      });
      // Handle both old format (array) and new format (object with products array)
      if (Array.isArray(data)) {
        return data;
      } else if (data && data.products) {
        return data.products;
      }
      return [];
    } catch (error) {
      console.error(
        `Error fetching detailed products (attempt ${i + 1}/${retries}):`,
        error
      );

      // If it's the last retry, return empty array
      if (i === retries - 1) {
        console.error("Failed to fetch detailed products after all retries");
        return [];
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  return [];
};

export const getProductById = async (id: string): Promise<Product | null> => {
  try {
    const { data } = await api.get(`/api/products/${id}`);

    // Handle images as strings (new format) or objects (old format)
    const images: string[] =
      data.images
        ?.map((img: any) => {
          if (typeof img === "string") {
            return img;
          } else if (img && typeof img === "object") {
            return img.url || `/${img.storage_path}`;
          }
          return "";
        })
        .filter((url: string) => url && url.trim() !== "") || [];

    const variants: ProductVariant[] = (data.variants || []).map((v: any) => ({
      id: v.id,
      sku: v.sku,
      price: v.price,
      stock_quantity: v.stock_quantity,
      size: v.size,
      color: v.color,
    }));

    return {
      ...data,
      images,
      colors: [...new Set(variants.map((v) => v.color).filter(Boolean))],
      sizes: [...new Set(variants.map((v) => v.size).filter(Boolean))],
      variants,
      features: (data.features || []).map((f: any) => f.feature || f),
      relatedProducts: (data.relatedProducts || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        image: p.images?.[0] || p.image || "/placeholder.jpg",
      })),
    };
  } catch {
    return null;
  }
};

export const getProductBySlug = async (
  slug: string
): Promise<Product | null> => {
  try {
    const { data } = await api.get("/api/products", { params: { slug } });
    if (data?.id && Object.keys(data).length === 1) {
      return getProductById(data.id);
    }
    return data;
  } catch {
    return null;
  }
};

// ---------- CRUD Operations ----------

export interface ProductCreateRequest {
  name: string;
  description?: string;
  price: number;
  category?: string;
  images?: string[];
}

export interface ProductUpdateRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  images?: string[];
}

export const createProduct = async (
  product: ProductCreateRequest
): Promise<Product | null> => {
  try {
    const { data } = await api.post("/api/products", product);
    return data;
  } catch (error) {
    console.error("Error creating product:", error);
    return null;
  }
};

export const updateProduct = async (
  id: string,
  product: ProductUpdateRequest
): Promise<Product | null> => {
  try {
    const { data } = await api.put(`/api/products/${id}`, product);
    return data;
  } catch (error) {
    console.error("Error updating product:", error);
    return null;
  }
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/api/products/${id}`);
    return true;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
};
