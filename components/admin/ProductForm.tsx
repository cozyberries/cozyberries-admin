"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ImageIcon, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Product, ProductVariant, Category } from "@/lib/types/product";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import Image from "next/image";
import { toast } from "sonner";

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: Product | Record<string, unknown>) => void;
  onCancel: () => void;
}

interface VariantRow extends ProductVariant {
  /** local draft values while the user is editing */
  draftPrice: string;
  draftStock: string;
  saving: boolean;
  dirty: boolean;
}

export default function ProductForm({
  product,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock_quantity: "",
    is_featured: false,
    category_slug: "",
    images: [] as string[],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<(File | string)[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  useEffect(() => {
    fetchCategories();
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        stock_quantity: product.stock_quantity?.toString() || "0",
        is_featured: product.is_featured || false,
        category_slug: product.category_slug || "",
        images: product.images ?? [],
      });
      setImageFiles(product.images ?? []);
      setVariantRows(
        (product.variants ?? []).map((v) => ({
          ...v,
          draftPrice: String(v.price),
          draftStock: String(v.stock_quantity),
          saving: false,
          dirty: false,
        }))
      );
    }
  }, [product]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleAddProductImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setImageFiles((prev) => [...prev, ...files]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const img of imageFiles) {
        if (typeof img === "string") {
          uploadedUrls.push(img);
        } else {
          const url = await uploadImageToCloudinary(img);
          uploadedUrls.push(url);
        }
      }

      const submitData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stock_quantity),
        is_featured: formData.is_featured,
        category_slug: formData.category_slug,
        images: uploadedUrls,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Update a variant's draft values locally */
  const handleVariantDraftChange = (
    variantSlug: string,
    field: "draftPrice" | "draftStock",
    value: string
  ) => {
    setVariantRows((rows) =>
      rows.map((r) =>
        r.slug === variantSlug ? { ...r, [field]: value, dirty: true } : r
      )
    );
  };

  /** Persist a single variant's price/stock to the server */
  const saveVariant = async (variantSlug: string) => {
    const row = variantRows.find((r) => r.slug === variantSlug);
    if (!row || !product) return;

    const price = parseFloat(row.draftPrice);
    const stock_quantity = parseInt(row.draftStock, 10);

    if (isNaN(price) || price < 0) {
      toast.error("Invalid price for variant " + row.size_slug);
      return;
    }
    if (isNaN(stock_quantity) || stock_quantity < 0) {
      toast.error("Invalid stock for variant " + row.size_slug);
      return;
    }

    setVariantRows((rows) =>
      rows.map((r) => (r.slug === variantSlug ? { ...r, saving: true } : r))
    );

    try {
      const res = await fetch(`/api/products/${product.id}/variants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ variantSlug, price, stock_quantity }),
      });

      if (res.ok) {
        setVariantRows((rows) =>
          rows.map((r) =>
            r.slug === variantSlug
              ? { ...r, price, stock_quantity, saving: false, dirty: false }
              : r
          )
        );
        toast.success(`Saved ${row.size_slug}`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save variant");
        setVariantRows((rows) =>
          rows.map((r) => (r.slug === variantSlug ? { ...r, saving: false } : r))
        );
      }
    } catch {
      toast.error("Network error saving variant");
      setVariantRows((rows) =>
        rows.map((r) => (r.slug === variantSlug ? { ...r, saving: false } : r))
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button variant="ghost" onClick={onCancel} className="w-fit">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {product ? "Edit Product" : "Add New Product"}
          </h1>
          <p className="text-gray-600 mt-0.5 text-sm sm:text-base">
            {product
              ? "Update product information"
              : "Create a new product for your catalog"}
          </p>
        </div>
      </div>

      {/* Main form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Images */}
            <div>
              <Label>Product Images</Label>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex flex-wrap gap-3">
                  {imageFiles?.length > 0 ? (
                    imageFiles.map((img, idx) => (
                      <div key={idx} className="relative">
                        <Image
                          src={
                            typeof img === "string"
                              ? img
                              : URL.createObjectURL(img)
                          }
                          alt={`Product ${idx}`}
                          width={80}
                          height={80}
                          className="rounded-md border object-cover w-20 h-20"
                        />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full py-1 px-[7px] text-xs leading-none"
                          onClick={() =>
                            setImageFiles((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="w-20 h-20 border rounded-md flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddProductImage}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter product name"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Base Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="stock_quantity">Total Stock</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    handleInputChange("stock_quantity", e.target.value)
                  }
                  placeholder="0"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category_slug">Category</Label>
              <select
                id="category_slug"
                value={formData.category_slug}
                onChange={(e) =>
                  handleInputChange("category_slug", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Featured toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) =>
                  handleInputChange("is_featured", checked)
                }
              />
              <Label htmlFor="is_featured">Featured Product</Label>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse gap-3 pt-6 border-t sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading
                  ? "Saving..."
                  : product
                    ? "Update Product"
                    : "Create Product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Variants table — edit mode only */}
      {product && variantRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Size Variants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile: stacked cards */}
            <div className="divide-y sm:hidden">
              {variantRows.map((row) => (
                <div key={row.slug} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm capitalize">
                      {row.size_slug}
                    </span>
                    <span className="text-xs text-gray-400">{row.color_slug}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1 block">Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.draftPrice}
                        onChange={(e) =>
                          handleVariantDraftChange(row.slug, "draftPrice", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        value={row.draftStock}
                        onChange={(e) =>
                          handleVariantDraftChange(row.slug, "draftStock", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!row.dirty || row.saving}
                    onClick={() => saveVariant(row.slug)}
                  >
                    {row.saving ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Save
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Size</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Color</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Price (₹)</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {variantRows.map((row) => (
                    <tr key={row.slug} className={row.dirty ? "bg-blue-50/40" : ""}>
                      <td className="px-4 py-2 font-medium capitalize">{row.size_slug}</td>
                      <td className="px-4 py-2 text-gray-500">{row.color_slug}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.draftPrice}
                          onChange={(e) =>
                            handleVariantDraftChange(row.slug, "draftPrice", e.target.value)
                          }
                          className="h-8 w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={row.draftStock}
                          onChange={(e) =>
                            handleVariantDraftChange(row.slug, "draftStock", e.target.value)
                          }
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="sm"
                          variant={row.dirty ? "default" : "outline"}
                          disabled={!row.dirty || row.saving}
                          onClick={() => saveVariant(row.slug)}
                          className="min-w-16"
                        >
                          {row.saving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
