"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Filter,
  MoreHorizontal,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Product } from "@/lib/types/product";
import ProductForm from "./ProductForm";
import Image from "next/image";
import { sendNotification } from "@/lib/utils/notify";
import { toast } from "sonner";

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "featured" | "active"
  >("all");

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
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
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

  const handleFormSubmit = async (productData: any) => {
    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : "/api/admin/products";

      const method = editingProduct ? "PUT" : "POST";

      let changedFields: string[] = [];
      if (editingProduct) {
        for (const key in productData) {
          if (
            productData[key] !== undefined &&
            productData[key] !== (editingProduct as any)[key]
          ) {
            changedFields.push(key);
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
        credentials: "include", // Ensure cookies are sent
      });

      if (response.ok) {
        setShowForm(false);
        setEditingProduct(null);
        fetchProducts(); // Refresh the list
        let title = editingProduct ? "Updated Product" : "Created Product";
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

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "featured" && product.is_featured) ||
      (filterStatus === "active" && !product.is_featured);

    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Product Management
          </h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <Button onClick={handleCreateProduct} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
              >
                All Products
              </Button>
              <Button
                variant={filterStatus === "featured" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("featured")}
              >
                Featured
              </Button>
              <Button
                variant={filterStatus === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("active")}
              >
                Active
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 -z-10">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {product.images && product.images.length > 0 ? (
                  <Image
                    src={product.images?.[0] || ""}
                    alt={product.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
                {product.is_featured && (
                  <Badge className="absolute top-2 left-2 bg-blue-500">
                    Featured
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg truncate">
                    {product.name}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleEditProduct(product)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
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
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {product.description || "No description"}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-sm text-gray-500">
                    Stock: {product.stock_quantity || 0}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500">
                    Category: {product.categories?.name || "Uncategorized"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No products found
            </h3>
            <p className="text-gray-500 mb-4">
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
