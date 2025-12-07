"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Folder,
  Eye,
  EyeOff,
  GripVertical,
  Palette,
} from "lucide-react";
import {
  ExpenseCategoryData,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate,
} from "@/lib/types/expense";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { toast } from "sonner";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface ExpenseCategoryManagementProps {}

const categoryFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-z0-9_]+$/, "Name must contain only lowercase letters, numbers, and underscores"),
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(200, "Display name must be less than 200 characters"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  icon: z.string(),
  sort_order: z.number().min(0).optional(),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

const iconOptions = [
  { value: "folder", label: "Folder", icon: "📁" },
  { value: "briefcase", label: "Briefcase", icon: "💼" },
  { value: "plane", label: "Plane", icon: "✈️" },
  { value: "megaphone", label: "Megaphone", icon: "📢" },
  { value: "monitor", label: "Monitor", icon: "🖥️" },
  { value: "settings", label: "Settings", icon: "⚙️" },
  { value: "zap", label: "Zap", icon: "⚡" },
  { value: "user-check", label: "User Check", icon: "✅" },
  { value: "graduation-cap", label: "Graduation Cap", icon: "🎓" },
  { value: "wrench", label: "Wrench", icon: "🔧" },
  { value: "more-horizontal", label: "More", icon: "⋯" },
];

const colorOptions = [
  "#8B5CF6", "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#06B6D4", "#8B5CF6", "#F97316", "#6B7280", "#64748B"
];

export default function ExpenseCategoryManagement({}: ExpenseCategoryManagementProps) {
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryData | null>(null);

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "", 
      display_name: "",
      description: "",
      color: "#6B7280",
      icon: "folder",
      sort_order: 0,
    },
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("admin", "true");
      if (showInactive) {
        params.append("include_inactive", "true");
      }

      const response = await authenticatedFetch(
        `/api/admin/expense-categories?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch expense categories");
      }

      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load expense categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [showInactive]);

  const handleCreateCategory: SubmitHandler<CategoryFormData> = async (data) => {
    try {
      const response = await authenticatedFetch("/api/admin/expense-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      toast.success("Expense category created successfully");
      setShowCreateDialog(false);
      form.reset();
      fetchCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    }
  };

  const handleUpdateCategory: SubmitHandler<CategoryFormData> = async (data) => {
    if (!selectedCategory) return;

    try {
      const response = await authenticatedFetch(
        `/api/admin/expense-categories/${selectedCategory.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      toast.success("Expense category updated successfully");
      setShowEditDialog(false);
      setSelectedCategory(null);
      form.reset();
      fetchCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await authenticatedFetch(
        `/api/admin/expense-categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      toast.success("Expense category deleted successfully");
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    }
  };

  const handleToggleStatus = async (category: ExpenseCategoryData) => {
    try {
      const response = await authenticatedFetch(
        `/api/admin/expense-categories/${category.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !category.is_active,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category status");
      }

      toast.success(`Category ${!category.is_active ? "activated" : "deactivated"} successfully`);
      fetchCategories();
    } catch (error) {
      console.error("Error updating category status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update category status");
    }
  };

  const openEditDialog = (category: ExpenseCategoryData) => {
    setSelectedCategory(category);
    form.reset({
      name: category.name,
      display_name: category.display_name,
      description: category.description || "",
      color: category.color,
      icon: category.icon,
      sort_order: category.sort_order,
    });
    setShowEditDialog(true);
  };

  const filteredCategories = categories.filter((category) =>
    category.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expense Categories</h1>
          <p className="text-gray-600">Manage expense categories for better organization</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <label htmlFor="show-inactive" className="text-sm font-medium">
                Show inactive
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>{filteredCategories.length} categories found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <GripVertical className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-mono text-sm">{category.sort_order}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-lg">{iconOptions.find(opt => opt.value === category.icon)?.icon || "📁"}</span>
                        <span className="font-medium">{category.display_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {category.name}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-gray-600 truncate">
                        {category.description || "No description"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_system ? "outline" : "secondary"}>
                        {category.is_system ? "System" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditDialog(category)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(category)}>
                            {category.is_active ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!category.is_system && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new expense category to organize your expenses better.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Office Supplies" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., office_supplies" {...field} />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, and underscores only
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this category covers..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <div className="flex gap-1">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: color }}
                              onClick={() => field.onChange(color)}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select icon" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {iconOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center">
                                <span className="mr-2">{option.icon}</span>
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Category</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the expense category details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Office Supplies" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCategory && !selectedCategory.is_system && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., office_supplies" {...field} />
                      </FormControl>
                      <FormDescription>
                        Lowercase letters, numbers, and underscores only
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this category covers..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                        </FormControl>
                        <div className="flex gap-1">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-6 h-6 rounded-full border border-gray-300"
                              style={{ backgroundColor: color }}
                              onClick={() => field.onChange(color)}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select icon" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {iconOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center">
                                <span className="mr-2">{option.icon}</span>
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Category</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
