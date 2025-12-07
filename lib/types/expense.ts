export type ExpenseStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export type ExpenseCategory =
  | "office_supplies"
  | "travel"
  | "marketing"
  | "software"
  | "equipment"
  | "utilities"
  | "professional_services"
  | "training"
  | "maintenance"
  | "other";

export interface ExpenseCategoryData {
  id: string;
  name: string;
  slug: string;
  display_name: string;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategoryCreate {
  name: string;
  display_name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface ExpenseCategoryUpdate {
  name?: string;
  slug?: string;
  display_name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  sort_order?: number;
}

export type ExpensePriority = "low" | "medium" | "high" | "urgent";

export type PaymentMethod =
  | "company_card"
  | "reimbursement"
  | "direct_payment"
  | "bank_transfer";

export interface ExpenseAttachment {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface ExpenseBase {
  title: string;
  description?: string;
  amount: number;
  category: ExpenseCategory;
  category_id?: string;
  priority: ExpensePriority;
  expense_date: string;
  vendor?: string;
  payment_method: PaymentMethod;
  receipt_url?: string;
  attachments?: ExpenseAttachment[];
  notes?: string;
  tags?: string[];
}

export interface ExpenseCreate extends ExpenseBase { }

export interface ExpenseUpdate {
  title?: string;
  description?: string;
  amount?: number;
  category?: ExpenseCategory;
  category_id?: string;
  priority?: ExpensePriority;
  expense_date?: string;
  vendor?: string;
  payment_method?: PaymentMethod;
  receipt_url?: string;
  notes?: string;
  tags?: string[];
  status?: ExpenseStatus;
}

export interface Expense extends ExpenseBase {
  id: string;
  user_id: string;
  status: ExpenseStatus;
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  created_at: string;
  updated_at: string;
  // Category details for display
  category_data?: ExpenseCategoryData;
  // User details for display
  user_profiles?: {
    id: string;
    email: string;
    full_name?: string;
  };
  approver?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface ExpenseSummary {
  total_expenses: number;
  pending_expenses: number;
  approved_expenses: number;
  rejected_expenses: number;
  paid_expenses: number;
  total_amount: number;
  pending_amount: number;
  approved_amount: number;
  rejected_amount: number;
  paid_amount: number;
  monthly_trends: {
    month: string;
    total_amount: number;
    count: number;
  }[];
  category_breakdown: {
    category: ExpenseCategory;
    total_amount: number;
    count: number;
  }[];
}

export interface ExpenseFilters {
  status?: ExpenseStatus[];
  category?: ExpenseCategory[];
  priority?: ExpensePriority[];
  user_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
}

export interface ExpenseStats {
  total_expenses: number;
  total_amount: number;
  average_amount: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  paid_count: number;
  this_month_amount: number;
  last_month_amount: number;
  monthly_growth: number;
}
