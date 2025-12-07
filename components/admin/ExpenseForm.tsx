"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ExpenseCreate,
  ExpenseUpdate,
  Expense,
  ExpenseCategory,
  ExpenseCategoryData,
  ExpensePriority,
  PaymentMethod,
} from "@/lib/types/expense";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { toast } from "sonner";
import { sendActivity } from "@/lib/utils/activities";

interface ExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<Expense>;
  expenseId?: string;
  isEdit?: boolean;
}

const expenseFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  category_id: z.string().min(1, "Category is required"),
  custom_category: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  expense_date: z.string().min(1, "Expense date is required"),
  vendor: z.string().optional(),
  payment_method: z.enum([
    "company_card",
    "reimbursement",
    "direct_payment",
    "bank_transfer",
  ]),
  receipt_url: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

const categoryLabels = {
  office_supplies: "Office Supplies",
  travel: "Travel",
  marketing: "Marketing",
  software: "Software",
  equipment: "Equipment",
  utilities: "Utilities",
  professional_services: "Professional Services",
  training: "Training",
  maintenance: "Maintenance",
  other: "Other",
};

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const paymentMethodLabels = {
  company_card: "Company Card",
  reimbursement: "Reimbursement",
  direct_payment: "Direct Payment",
  bank_transfer: "Bank Transfer",
};

export default function ExpenseForm({
  onSuccess,
  onCancel,
  initialData,
  expenseId,
  isEdit = false,
}: ExpenseFormProps) {
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [otherCategoryId, setOtherCategoryId] = useState<string | null>(null);

  const { fetch: authenticatedFetch } = useAuthenticatedFetch();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      amount: initialData?.amount || 0,
      category_id: initialData?.category_id || "",
      custom_category: "",
      priority: initialData?.priority || "medium",
      expense_date:
        initialData?.expense_date || new Date().toISOString().split("T")[0],
      vendor: initialData?.vendor || "",
      payment_method: initialData?.payment_method || "company_card",
      receipt_url: initialData?.receipt_url || "",
      notes: initialData?.notes || "",
      tags: initialData?.tags || [],
    },
  });

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await authenticatedFetch(
        "/api/admin/expense-categories"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      const data = await response.json();
      setCategories(data.categories || []);

      // Find the "Other" category ID for custom category logic
      const otherCategory = data.categories?.find(
        (cat: ExpenseCategoryData) => cat.name === "other"
      );
      if (otherCategory) {
        setOtherCategoryId(otherCategory.id);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load expense categories");
    } finally {
      setCategoriesLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, []);

  // Initialize showCustomCategory state when editing an expense
  React.useEffect(() => {
    if (
      initialData?.category_id &&
      otherCategoryId &&
      initialData.category_id === otherCategoryId
    ) {
      setShowCustomCategory(true);
    }
  }, [initialData?.category_id, otherCategoryId]);

  // Function to create a new custom category
  const createCustomCategory = async (
    categoryName: string
  ): Promise<string> => {
    try {
      const categoryData = {
        name: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        display_name: categoryName,
        description: `Custom category: ${categoryName}`,
        color: "#6B7280",
        icon: "folder",
      };

      const response = await authenticatedFetch(
        "/api/admin/expense-categories",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(categoryData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create custom category");
      }

      const newCategory = await response.json();

      // Refresh categories list to include the new category
      await fetchCategories();

      return newCategory.id;
    } catch (error) {
      console.error("Error creating custom category:", error);
      throw error;
    }
  };

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      setLoading(true);

      // Validate custom category when "Other" is selected
      if (
        data.category_id === otherCategoryId &&
        !data.custom_category?.trim()
      ) {
        form.setError("custom_category", {
          type: "required",
          message: 'Custom category name is required when "Other" is selected',
        });
        setLoading(false);
        return;
      }

      let finalCategoryId = data.category_id;

      // If "Other" category is selected and custom category is provided
      if (
        data.category_id === otherCategoryId &&
        data.custom_category?.trim()
      ) {
        try {
          finalCategoryId = await createCustomCategory(
            data.custom_category.trim()
          );
          toast.success(
            `Custom category "${data.custom_category.trim()}" created successfully`
          );
        } catch (error) {
          toast.error("Failed to create custom category");
          throw error;
        }
      }

      const expenseData = {
        ...data,
        category_id: finalCategoryId,
        tags: tags,
      };

      // Remove custom_category from the data sent to the API
      delete expenseData.custom_category;

      const url =
        isEdit && expenseId
          ? `/api/admin/expenses/${expenseId}`
          : "/api/admin/expenses";

      const method = isEdit ? "PUT" : "POST";

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to ${isEdit ? "update" : "create"} expense`
        );
      }

      toast.success(
        isEdit ? "Expense updated successfully" : "Expense created successfully"
      );
      onSuccess?.();
      await sendActivity(isEdit ? "expense_updated" : "expense_created", isEdit ? `Expense ${expenseData.title} updated successfully` : `Expense ${expenseData.title} created successfully`, expenseData.title);
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit expense"
      );
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      form.setValue("tags", newTags);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags);
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter expense title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (₹) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter expense description"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Provide details about the expense
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setShowCustomCategory(value === otherCategoryId);
                    // Clear custom category when switching away from "Other"
                    if (value !== otherCategoryId) {
                      form.setValue("custom_category", "");
                    }
                  }}
                  value={field.value}
                  disabled={categoriesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          categoriesLoading
                            ? "Loading categories..."
                            : "Select category"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span>{category.display_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Custom Category Input - shown when "Other" is selected */}
          {showCustomCategory && (
            <FormField
              control={form.control}
              name="custom_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Category Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter custom category name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This will create a new category that can be reused for
                    future expenses
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="expense_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expense Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(paymentMethodLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="vendor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor/Supplier</FormLabel>
              <FormControl>
                <Input placeholder="Enter vendor name" {...field} />
              </FormControl>
              <FormDescription>
                Name of the company or individual paid
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="receipt_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receipt/Document URL</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter receipt URL or upload document"
                    {...field}
                  />
                  <Button type="button" variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Link to receipt, invoice, or supporting document
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Tags</FormLabel>
          <div className="flex gap-2">
            <Input
              placeholder="Add tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagInputKeyPress}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Add tags to categorize and search expenses easily
          </p>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional information or notes"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? "Submitting..."
              : isEdit
              ? "Update Expense"
              : "Create Expense"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
