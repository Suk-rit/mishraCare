-- ============================================================
-- MishraCare — Migration 015
-- 1. inventory_requests  — store manager requests medicine from admin
-- 2. devta_expenses      — devta's own operational expenses
-- 3. vishnu_reports      — reports created by Vishnu with notes
-- ============================================================

-- ── 1. Inventory Requests ────────────────────────────────────────────────────
-- Store manager can request a medicine that exists in admin inventory,
-- or request a completely new medicine by writing its name.
CREATE TABLE IF NOT EXISTS public.inventory_requests (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Who is requesting
  store_id         uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  manager_id       uuid          NOT NULL REFERENCES public.store_managers(id) ON DELETE CASCADE,

  -- Which admin's inventory to pull from
  admin_id         uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,

  -- If requesting an existing medicine batch
  medicine_id      uuid          NULL REFERENCES public.medicines(id) ON DELETE SET NULL,
  batch_id         uuid          NULL REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  medicine_name    varchar(255)  NULL,   -- snapshot or freeform if new
  batch_number     varchar(100)  NULL,   -- snapshot

  -- Request details
  quantity_units   integer       NOT NULL CHECK (quantity_units > 0),
  request_type     varchar(20)   NOT NULL DEFAULT 'existing',
    -- existing (from admin batch) | new (medicine not in system)
  notes            text          NULL,   -- reason / urgency

  -- Admin response
  status           varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | fulfilled
  admin_note       text          NULL,
  responded_at     timestamptz   NULL,

  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT inv_req_pkey PRIMARY KEY (id),
  CONSTRAINT inv_req_type_check   CHECK (request_type IN ('existing','new')),
  CONSTRAINT inv_req_status_check CHECK (status IN ('pending','approved','rejected','fulfilled'))
);

CREATE INDEX IF NOT EXISTS idx_inv_req_store   ON public.inventory_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_inv_req_admin   ON public.inventory_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_inv_req_status  ON public.inventory_requests(status);

CREATE TRIGGER inv_req_updated_at
  BEFORE UPDATE ON public.inventory_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.inventory_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 2. Devta Expenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devta_expenses (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),
  devta_id         uuid          NOT NULL REFERENCES public.devta(id) ON DELETE CASCADE,

  category         varchar(50)   NOT NULL DEFAULT 'miscellaneous',
  description      text          NOT NULL,
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date     date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method   varchar(20)   NOT NULL DEFAULT 'cash',
  proof_url        text          NULL,
  notes            text          NULL,

  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT devta_exp_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_devta_exp_devta ON public.devta_expenses(devta_id);
CREATE INDEX IF NOT EXISTS idx_devta_exp_date  ON public.devta_expenses(expense_date);

CREATE TRIGGER devta_exp_updated_at
  BEFORE UPDATE ON public.devta_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.devta_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.devta_expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 3. Vishnu Reports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vishnu_reports (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),

  title            varchar(200)  NOT NULL,
  period_from      date          NOT NULL,
  period_to        date          NOT NULL,
  notes            text          NULL,

  -- Financial snapshot at time of report creation (stored so report is immutable)
  total_sales      numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses   numeric(14,2) NOT NULL DEFAULT 0,
  net_amount       numeric(14,2) GENERATED ALWAYS AS (total_sales - total_expenses) STORED,

  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT vishnu_reports_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vishnu_reports_date ON public.vishnu_reports(period_from, period_to);

CREATE TRIGGER vishnu_reports_updated_at
  BEFORE UPDATE ON public.vishnu_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.vishnu_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.vishnu_reports
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── Storage bucket for devta expense proofs ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'devta-expense-proofs', 'devta-expense-proofs', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon upload devta-exp" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'devta-expense-proofs');
CREATE POLICY "Allow anon read devta-exp" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'devta-expense-proofs');
