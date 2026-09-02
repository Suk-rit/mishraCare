-- ============================================================
-- JanSwasthya — Migration 011: Devta User + Purchase Order Bills
--
-- 1. devta table         — the verification/approval user
-- 2. purchase_order_bills — PDF bill records generated on approval
-- ============================================================

-- ── 1. Devta (single super-verifier, like Vishnu but for stock) ──
CREATE TABLE IF NOT EXISTS public.devta (
  id           uuid         NOT NULL DEFAULT gen_random_uuid(),
  name         varchar(100) NOT NULL,
  email        varchar(255) NOT NULL UNIQUE,
  password     text         NOT NULL,
  is_active    boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT devta_pkey PRIMARY KEY (id)
);

-- Seed devta users
INSERT INTO public.devta (name, email, password)
VALUES
  ('Devta',       'devta@janswasthya.com', 'devta@123'),
  ('Rohit Mishra','rohitmishra@gmail.com','Rohit@321')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.devta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.devta
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 2. purchase_order_bills — generated when devta approves a batch group ──
--    One bill = one approval action covering one or more medicine_batches
--    from the same admin. PDF URL stored here after generation.
CREATE TABLE IF NOT EXISTS public.purchase_order_bills (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Identity
  bill_number     varchar(100)  NOT NULL UNIQUE,
    -- format: AdminName_YYYYMMDD_XXXX  e.g. "Rajesh_20260829_0001"

  -- Who submitted / who approved
  admin_id        uuid          NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  devta_id        uuid          NULL REFERENCES public.devta(id) ON DELETE SET NULL,
  approved_at     timestamptz   NOT NULL DEFAULT now(),

  -- What was approved (array of batch IDs in this bill)
  -- We store them as a denormalized snapshot too, for the PDF
  batch_ids       uuid[]        NOT NULL DEFAULT '{}',

  -- Supplier info (from the batches)
  supplier_name   varchar(200)  NULL,
  supplier_invoice varchar(100) NULL,
  purchase_date   date          NOT NULL DEFAULT CURRENT_DATE,

  -- Financial summary
  total_medicines integer       NOT NULL DEFAULT 0,
  total_batches   integer       NOT NULL DEFAULT 0,
  total_units     integer       NOT NULL DEFAULT 0,
  total_cost      numeric(12,2) NOT NULL DEFAULT 0,   -- sum of cost_price_per_pack * packs
  bill_amount     numeric(12,2) NOT NULL DEFAULT 0,   -- as on stockist bill
  stockist_bill_url text        NULL,                 -- original uploaded bill image

  -- Generated PDF
  pdf_url         text          NULL,   -- Supabase storage URL of generated PDF
  pdf_generated   boolean       NOT NULL DEFAULT false,

  -- Notes
  devta_note      text          NULL,
  admin_note      text          NULL,

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT po_bills_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_po_bills_admin   ON public.purchase_order_bills(admin_id);
CREATE INDEX IF NOT EXISTS idx_po_bills_devta   ON public.purchase_order_bills(devta_id);
CREATE INDEX IF NOT EXISTS idx_po_bills_date    ON public.purchase_order_bills(approved_at);
CREATE INDEX IF NOT EXISTS idx_po_bills_number  ON public.purchase_order_bills(bill_number);

CREATE TRIGGER po_bills_updated_at
  BEFORE UPDATE ON public.purchase_order_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.purchase_order_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.purchase_order_bills
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ── 3. Link medicine_batches to the bill that approved them ──
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS approved_bill_id uuid NULL
    REFERENCES public.purchase_order_bills(id) ON DELETE SET NULL;

ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL
    REFERENCES public.devta(id) ON DELETE SET NULL;

ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL;

ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS rejection_note text NULL;

CREATE INDEX IF NOT EXISTS idx_batches_bill ON public.medicine_batches(approved_bill_id);


-- ── 4. Storage bucket for generated PDF bills ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-order-pdfs',
  'purchase-order-pdfs',
  true,
  20971520,  -- 20 MB
  ARRAY['application/pdf', 'text/html']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon upload po-pdfs" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'purchase-order-pdfs');

CREATE POLICY "Allow anon read po-pdfs" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'purchase-order-pdfs');
