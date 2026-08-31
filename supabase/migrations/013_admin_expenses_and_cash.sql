-- ============================================================
-- MishraCare — Migration 013: Admin Region Expenses + Cash Register
--
-- 1. admin_expenses  — admin-level costs (warehouse staff, travel,
--                      utilities, inventory transport, misc)
-- 2. store_cash_register — daily cash snapshot per store
--    (cash collected from billing, deposited to bank, balance on hand)
-- ============================================================

-- ── 1. Admin expenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_expenses (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  admin_id        uuid          NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,

  category        varchar(50)   NOT NULL,
    -- inventory_transport | staff_salary | office_rent | utilities
    -- travel | marketing | bank_charges | miscellaneous
  description     text          NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date    date          NOT NULL DEFAULT CURRENT_DATE,

  payment_method  varchar(20)   NOT NULL DEFAULT 'cash',
    -- cash | upi | bank_transfer | cheque

  -- Proof (receipt/invoice image or PDF)
  proof_url       text          NULL,

  notes           text          NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT admin_exp_pkey PRIMARY KEY (id),
  CONSTRAINT admin_exp_category_check CHECK (
    category IN (
      'inventory_transport','staff_salary','office_rent','utilities',
      'travel','marketing','bank_charges','miscellaneous'
    )
  ),
  CONSTRAINT admin_exp_payment_check CHECK (
    payment_method IN ('cash','upi','bank_transfer','cheque')
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_exp_admin    ON public.admin_expenses(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_exp_date     ON public.admin_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_admin_exp_category ON public.admin_expenses(category);

CREATE TRIGGER admin_exp_updated_at
  BEFORE UPDATE ON public.admin_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.admin_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.admin_expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 2. Store cash register ────────────────────────────────────────────────────
-- One row per store per date.
-- cash_in  = sum of cash payments received from bills that day
-- deposited = amount physically deposited to bank
-- balance  = cash_in (cumulative) - deposited (cumulative) = cash on hand
CREATE TABLE IF NOT EXISTS public.store_cash_register (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  register_date   date          NOT NULL DEFAULT CURRENT_DATE,

  -- Revenue collected today by payment method
  cash_collected  numeric(12,2) NOT NULL DEFAULT 0,
  upi_collected   numeric(12,2) NOT NULL DEFAULT 0,
  card_collected  numeric(12,2) NOT NULL DEFAULT 0,

  -- Bank deposit made from this store today
  cash_deposited  numeric(12,2) NOT NULL DEFAULT 0,
  deposit_ref     varchar(100)  NULL,    -- bank reference / UTR number
  deposit_proof   text          NULL,    -- URL of deposit slip

  -- Running balance (set by app: previous balance + cash_collected - cash_deposited)
  cash_on_hand    numeric(12,2) NOT NULL DEFAULT 0,

  notes           text          NULL,
  updated_by      uuid          NULL REFERENCES public.store_managers(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT store_cash_pkey PRIMARY KEY (id),
  CONSTRAINT store_cash_unique UNIQUE (store_id, register_date)
);

CREATE INDEX IF NOT EXISTS idx_cash_store ON public.store_cash_register(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_date  ON public.store_cash_register(register_date);

CREATE TRIGGER store_cash_updated_at
  BEFORE UPDATE ON public.store_cash_register
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.store_cash_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.store_cash_register
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 3. Storage bucket for admin expense proofs ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-expense-proofs',
  'admin-expense-proofs',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon upload admin-exp-proofs" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'admin-expense-proofs');

CREATE POLICY "Allow anon read admin-exp-proofs" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'admin-expense-proofs');
