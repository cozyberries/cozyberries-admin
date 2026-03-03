-- ============================================================
-- Expense Categories Table
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT,
  color         TEXT NOT NULL DEFAULT '#6B7280',
  icon          TEXT NOT NULL DEFAULT 'folder',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT,                          -- admin user id (JWT-based, not auth.users)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the system categories that match the ExpenseCategory enum
INSERT INTO expense_categories (name, slug, display_name, color, icon, is_system, sort_order) VALUES
  ('office_supplies',       'office-supplies',       'Office Supplies',       '#3B82F6', 'package',         TRUE, 1),
  ('travel',                'travel',                'Travel',                '#8B5CF6', 'plane',           TRUE, 2),
  ('marketing',             'marketing',             'Marketing',             '#EC4899', 'megaphone',       TRUE, 3),
  ('software',              'software',              'Software',              '#06B6D4', 'monitor',         TRUE, 4),
  ('equipment',             'equipment',             'Equipment',             '#F59E0B', 'tool',            TRUE, 5),
  ('utilities',             'utilities',             'Utilities',             '#10B981', 'zap',             TRUE, 6),
  ('professional_services', 'professional-services', 'Professional Services', '#6366F1', 'briefcase',       TRUE, 7),
  ('training',              'training',              'Training',              '#F97316', 'book-open',       TRUE, 8),
  ('maintenance',           'maintenance',           'Maintenance',           '#84CC16', 'wrench',          TRUE, 9),
  ('other',                 'other',                 'Other',                 '#6B7280', 'more-horizontal', TRUE, 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Expenses Table
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category         TEXT NOT NULL,              -- matches ExpenseCategory enum values
  category_id      UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  priority         TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  expense_date     DATE NOT NULL,
  vendor           TEXT,
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('company_card', 'reimbursement', 'direct_payment', 'bank_transfer')),
  receipt_url      TEXT,
  notes            TEXT,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  approved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejected_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id      ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status        ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id   ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date  ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at    ON expenses(created_at DESC);

-- RLS: allow service-role (admin client) full access, restrict anon
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default — no policy needed for admin client.
-- Authenticated users can read active categories:
CREATE POLICY "Authenticated users can read active expense_categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (is_active = TRUE);
