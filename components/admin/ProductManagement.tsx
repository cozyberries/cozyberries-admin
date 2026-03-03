"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Package,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Product, ProductVariant } from "@/lib/types/product";
import ProductForm from "./ProductForm";
import Image from "next/image";
import { sendNotification } from "@/lib/utils/notify";
import { toast } from "sonner";

type FilterStatus = "all" | "featured" | "in-stock" | "out-of-stock" | "disabled";

function StockBadge({ quantity }: { quantity: number | null | undefined }) {
  if (quantity === null || quantity === undefined) {
    return (
      <Badge variant="destructive" className="text-xs font-normal">
        Stock Missing
      </Badge>
    );
  }
  if (quantity === 0) {
    return (
      <Badge variant="destructive" className="text-xs font-normal">
        Out of Stock
      </Badge>
    );
  }
  if (quantity <= 5) {
    return (
      <Badge className="text-xs font-normal bg-amber-500 hover:bg-amber-600">
        Low: {quantity}
      </Badge>
    );
  }
  return (
    <Badge className="text-xs font-normal bg-green-600 hover:bg-green-700">
      In Stock: {quantity}
    </Badge>
  );
}

function VariantStockChip({ variant }: { variant: ProductVariant }) {
  const qty = variant.stock_quantity;

  let stockClass = "bg-green-100 text-green-800";
  if (qty === 0) stockClass = "bg-red-100 text-red-700";
  else if (qty <= 5) stockClass = "bg-amber-100 text-amber-800";

  return (
    <span className="inline-flex items-stretch rounded overflow-hidden border border-gray-200 text-[11px] font-medium">
      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 capitalize">
        {variant.size_slug}
      </span>
      <span className={`px-1.5 py-0.5 ${stockClass}`}>{qty}</span>
    </span>
  );
}

function PriceDisplay({ product }: { product: Product }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  if (!product.variants || product.variants.length === 0) {
    return (
      <span className="text-lg sm:text-xl font-bold text-green-600">
        {formatCurrency(product.price)}
      </span>
    );
  }

  const prices = product.variants.map((v) => Number(v.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return (
      <span className="text-lg sm:text-xl font-bold text-green-600">
        {formatCurrency(min)}
      </span>
    );
  }

  return (
    <span className="text-base sm:text-lg font-bold text-green-600">
      {formatCurrency(min)}
      <span className="text-gray-400 font-normal mx-1">–</span>
      {formatCurrency(max)}
    </span>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/products?limit=100");
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProducts(products.filter((p) => p.id !== productId));
        await sendNotification("Product Deleted", `Product ${productId} has been deleted`, "success");
        toast.success("Product deleted successfully");
      } else {
        toast.error("Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Error deleting product");
    }
  };

  const handleToggleActive = async (product: Product) => {
    const nextActive = !(product.is_active ?? true);
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: nextActive } : p))
    );
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: !nextActive } : p))
        );
        toast.error("Failed to update product status");
      } else {
        toast.success(nextActive ? "Product enabled" : "Product disabled");
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !nextActive } : p))
      );
      toast.error("Network error updating product status");
    }
  };

  const handleFormSubmit = async (productData: Product | Record<string, unknown>) => {
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const changedFields: string[] = [];
      if (editingProduct) {
        const data = productData as Record<string, unknown>;
        const existing = editingProduct as unknown as Record<string, unknown>;
        for (const key in data) {
          if (data[key] !== undefined && data[key] !== existing[key]) {
            changedFields.push(key);
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
        credentials: "include",
      });

      if (response.ok) {
        setShowForm(false);
        setEditingProduct(null);
        fetchProducts();
        const title = editingProduct ? "Updated Product" : "Created Product";
        let message = editingProduct
          ? `Product ${productData.name || editingProduct.name} has been updated.`
          : `New product ${productData.name} has been created.`;
        if (editingProduct && changedFields.length > 0) {
          message += `\n\nChanged fields: ${changedFields.join(", ")}`;
        }
        await sendNotification(title, message, "success");
        toast.success(editingProduct ? "Product updated successfully" : "Product created successfully");
      } else {
        const error = await response.json();
        console.error("Error response:", error);
        toast.error(`Failed to ${editingProduct ? "update" : "create"} product.`);
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error saving product");
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const totalStock = product.variants && product.variants.length > 0
      ? product.variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0)
      : (product.stock_quantity ?? 0);

    const isActive = product.is_active ?? true;

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "featured" && product.is_featured) ||
      (filterStatus === "in-stock" && totalStock > 0) ||
      (filterStatus === "out-of-stock" && totalStock === 0) ||
      (filterStatus === "disabled" && !isActive);

    return matchesSearch && matchesFilter;
  });

  if (showForm) {
    return (
      <ProductForm
        product={editingProduct}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingProduct(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Product Management
          </h1>
          <p className="text-gray-600 mt-0.5 text-sm sm:text-base">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={handleCreateProduct} className="w-full sm:w-auto flex items-center justify-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
                className="flex-1 sm:flex-none"
              >
                All
              </Button>
              <Button
                variant={filterStatus === "featured" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("featured")}
                className="flex-1 sm:flex-none"
              >
                Featured
              </Button>
              <Button
                variant={filterStatus === "in-stock" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("in-stock")}
                className="flex-1 sm:flex-none"
              >
                In Stock
              </Button>
              <Button
                variant={filterStatus === "out-of-stock" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("out-of-stock")}
                className={`flex-1 sm:flex-none ${filterStatus === "out-of-stock" ? "bg-red-600 hover:bg-red-700 border-red-600" : "text-red-600 border-red-200 hover:bg-red-50"}`}
              >
                Out of Stock
              </Button>
              <Button
                variant={filterStatus === "disabled" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("disabled")}
                className={`flex-1 sm:flex-none ${filterStatus === "disabled" ? "bg-gray-600 hover:bg-gray-700 border-gray-600" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              >
                Disabled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 sm:p-6">
                <div className="animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          data-testid="product-list"
        >
          {filteredProducts.map((product, index) => {
            const primaryImage = product.images?.[0];
            const hasVariants = product.variants && product.variants.length > 0;

            const isActive = product.is_active ?? true;

            return (
              <Card
                key={product.id ?? index}
                className={`overflow-hidden transition-opacity ${isActive ? "" : "opacity-60"}`}
              >
                {/* Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {primaryImage ? (
                    <Image
                      src={primaryImage}
                      alt={product.name}
                      fill
                      className="object-cover rounded-t-lg"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                      <Package className="h-10 w-10" />
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {product.is_featured && (
                      <Badge className="bg-blue-500">Featured</Badge>
                    )}
                    {!isActive && (
                      <Badge variant="secondary" className="bg-gray-700 text-white">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <CardContent className="p-3 sm:p-4">
                  {/* Title + dropdown */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-semibold text-base sm:text-lg leading-tight min-w-0 break-words">
                      {product.name}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                          {isActive ? (
                            <>
                              <ToggleLeft className="h-4 w-4 mr-2 text-gray-500" />
                              Disable
                            </>
                          ) : (
                            <>
                              <ToggleRight className="h-4 w-4 mr-2 text-green-600" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-gray-500 text-xs sm:text-sm mb-3 line-clamp-2">
                    {product.description || "No description"}
                  </p>

                  {/* Price + aggregate stock */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <PriceDisplay product={product} />
                    {!hasVariants && <StockBadge quantity={product.stock_quantity} />}
                  </div>

                  {/* Per-size variant chips */}
                  {hasVariants && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.variants!.map((v) => (
                        <VariantStockChip key={v.slug} variant={v} />
                      ))}
                    </div>
                  )}

                  {/* Category */}
                  <div className="mt-1">
                    <span className="text-xs text-gray-400">
                      {product.categories?.name || "Uncategorized"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No products found
            </h3>
            <p className="text-gray-500 mb-4 text-sm">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Get started by adding your first product"}
            </p>
            <Button onClick={handleCreateProduct}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
