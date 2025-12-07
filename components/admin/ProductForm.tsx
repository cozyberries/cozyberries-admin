"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ImageIcon, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Product } from "@/lib/types/product";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import Image from "next/image";

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ProductForm({
  product,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: string;
    stock_quantity: string;
    is_featured: boolean;
    category_id: string;
    images: string[];
  }>({
    name: "",
    description: "",
    price: "",
    stock_quantity: "",
    is_featured: false,
    category_id: "",
    images: [],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<(File | string)[]>([]);

  useEffect(() => {
    fetchCategories();
    if (product) {
      const imageUrls = product?.images ?? [];
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        stock_quantity: product.stock_quantity?.toString() || "0",
        is_featured: product.is_featured || false,
        category_id: product.category_id || "",
        images: imageUrls,
      });
      setImageFiles(imageUrls);
    }
  }, [product]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        // The API returns categories directly as an array, not wrapped in a categories property
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
        category_id: formData.category_id,
        images: uploadedUrls,
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {product ? "Edit Product" : "Add New Product"}
          </h1>
          <p className="text-gray-600 mt-1">
            {product
              ? "Update product information"
              : "Create a new product for your catalog"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label>Product Images</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {/* Show existing images */}
                  {imageFiles?.length > 0 ? (
                    imageFiles?.map((img: File | string, idx: number) => (
                      <div key={idx} className="relative">
                        <Image
                          src={typeof img === 'string' ? img : URL.createObjectURL(img)}
                          alt={`Product ${idx}`}
                          width={80}
                          height={80}
                          className="rounded-md border"
                        />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full py-1 px-[7px] text-xs"
                          onClick={() => {
                            setImageFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
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
                  <div className="flex flex-col">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAddProductImage}
                    />
                  </div>
                </div>
              </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹) *</Label>
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
                  <Label htmlFor="stock_quantity">Stock Quantity</Label>
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

              <div>
                <Label htmlFor="category_id">Category</Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) =>
                    handleInputChange("category_id", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

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
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
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
    </div>
  );
}
