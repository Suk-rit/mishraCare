-- ============================================================
-- MishraCare — Medicine Batches / Stock
-- ============================================================

CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,

  -- Batch identity
  batch_number        varchar(100)  NOT NULL,
  date_of_manufacture date          NULL,
  expiry_date         date          NOT NULL,

  -- Supplier / Purchase
  supplier_name       varchar(200)  NULL,
  supplier_invoice    varchar(100)  NULL,
  purchase_date       date          NULL DEFAULT CURRENT_DATE,

  -- Pricing
  cost_price_per_pack numeric(10,2) NULL,
  mrp_per_pack        numeric(10,2) NULL,

  -- Quantity
  quantity_packs      integer       NOT NULL DEFAULT 0,
  quantity_loose      integer       NOT NULL DEFAULT 0,
  -- total_units and units_remaining are set on insert/update by the app
  total_units         integer       NOT NULL DEFAULT 0,
  units_remaining     integer       NOT NULL DEFAULT 0,

  -- Status
  is_active           boolean       NOT NULL DEFAULT true,
  notes               text          NULL,

  -- Meta
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT medicine_batches_pkey PRIMARY KEY (id),
  CONSTRAINT medicine_batches_batch_med_unique UNIQUE (medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_medicine_id ON public.medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry       ON public.medicine_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON public.medicine_batches(batch_number);

CREATE TRIGGER medicine_batches_updated_at
  BEFORE UPDATE ON public.medicine_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.medicine_batches
  FOR ALL TO anon USING (true) WITH CHECK (true);
