-- ============================================================
-- JanSwasthya — Sales, Billing, Expenses & Analytics
-- ============================================================

-- Add selling_price to store_inventory
-- (cost_price is already there from transfer; selling_price set by store manager)
ALTER TABLE public.store_inventory
  ADD COLUMN IF NOT EXISTS selling_price_per_unit numeric(10,4) NULL;

-- ── Bills (sale transactions) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bills (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bill_number     varchar(50)   NOT NULL,  -- auto-generated: STORE-YYYYMMDD-NNNN
  customer_name   varchar(150)  NULL,
  customer_phone  varchar(20)   NULL,
  
  -- Financials
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total_amount    numeric(12,2) NOT NULL DEFAULT 0,
  total_cost      numeric(12,2) NOT NULL DEFAULT 0,  -- sum of cost prices
  gross_profit    numeric(12,2) GENERATED ALWAYS AS (total_amount - total_cost) STORED,

  payment_method  varchar(20)   NOT NULL DEFAULT 'cash',
    -- cash | upi | card | credit
  status          varchar(20)   NOT NULL DEFAULT 'paid',
    -- paid | pending | cancelled | refunded

  notes           text          NULL,
  billed_by       uuid          NULL REFERENCES public.store_managers(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bills_pkey PRIMARY KEY (id),
  CONSTRAINT bills_number_store_unique UNIQUE (store_id, bill_number)
);

CREATE INDEX IF NOT EXISTS idx_bills_store    ON public.bills(store_id);
CREATE INDEX IF NOT EXISTS idx_bills_date     ON public.bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_status   ON public.bills(status);

CREATE TRIGGER bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.bills
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Bill Items (line items per bill) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_items (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  bill_id             uuid          NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  store_inventory_id  uuid          NULL REFERENCES public.store_inventory(id) ON DELETE SET NULL,
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id),

  -- Snapshot at time of sale
  medicine_name       varchar(255)  NOT NULL,
  batch_number        varchar(100)  NULL,
  expiry_date         date          NULL,

  -- Qty
  quantity_units      integer       NOT NULL,
  pack_size           integer       NOT NULL DEFAULT 1,

  -- Pricing
  selling_price_per_unit numeric(10,4) NOT NULL,  -- per single unit
  cost_price_per_unit    numeric(10,4) NOT NULL DEFAULT 0,
  
  -- Computed
  line_total          numeric(12,2) GENERATED ALWAYS AS (
    ROUND((selling_price_per_unit * quantity_units)::numeric, 2)
  ) STORED,
  line_cost           numeric(12,2) GENERATED ALWAYS AS (
    ROUND((cost_price_per_unit * quantity_units)::numeric, 2)
  ) STORED,
  line_profit         numeric(12,2) GENERATED ALWAYS AS (
    ROUND(((selling_price_per_unit - cost_price_per_unit) * quantity_units)::numeric, 2)
  ) STORED,

  created_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bill_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill     ON public.bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_medicine ON public.bill_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_inv      ON public.bill_items(store_inventory_id);

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.bill_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Expenses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  admin_id        uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,

  category        varchar(50)   NOT NULL,
    -- inventory | salary | rent | utilities | maintenance | transport | marketing | other
  description     text          NOT NULL,
  amount          numeric(12,2) NOT NULL,
  expense_date    date          NOT NULL DEFAULT CURRENT_DATE,
  
  -- Proof
  proof_url       text          NULL,   -- Supabase storage URL
  
  -- Optional links
  reference_type  varchar(30)   NULL,   -- employee | transfer | other
  reference_id    uuid          NULL,

  notes           text          NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expense_category_check CHECK (
    category IN ('inventory','salary','rent','utilities','maintenance','transport','marketing','other')
  )
);

CREATE INDEX IF NOT EXISTS idx_expenses_store    ON public.expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_admin    ON public.expenses(admin_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Storage bucket for expense proofs ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-proofs','expense-proofs',true,10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon expense uploads" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'expense-proofs');
CREATE POLICY "Allow anon expense reads" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'expense-proofs');
