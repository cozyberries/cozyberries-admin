export interface ProductImage {
  id: string;
  storage_path: string;
  is_primary?: boolean;
  display_order?: number;
  url?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stock_quantity: number;
  size: string;
  color: string;
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

export interface ProductBase {
  name: string;
  description?: string;
  price: number;
  category?: string;
  images?: string[];
}

export interface ProductCreate extends ProductBase {}

export interface ProductUpdate {
  name?: string;
  description?: string;
  price?: number;
  category_id?: string; 
  stock_quantity?: number;
  is_featured?: boolean;
  images?: string[];
}


export interface Product extends ProductBase {
  id: string;
  created_at: string;
  updated_at?: string;
  slug?: string;
  stock_quantity?: number;
  is_featured?: boolean;
  category_id?: string;
  categories?: { name: string };
  images?: string[];
}

export interface CategoryImage {
  id: string;
  storage_path: string;
  is_primary?: boolean;
  display_order?: number;
  metadata?: any;
  url?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
}
