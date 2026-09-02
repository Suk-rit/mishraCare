-- ============================================================
-- JanSwasthya — Migration 012: Discount on Batches + Doctors Table
--
-- 1. discount_percent on medicine_batches  (set by admin when adding stock)
-- 2. discount_percent on store_inventory   (carried over from batch on transfer)
-- 3. doctors table                         (for bill referral search)
-- 4. referred_by on bills                  (FK → doctors)
-- 5. payment split columns on bills        (cash + card + upi breakdowns)
-- ============================================================

-- ── 1. Discount on admin batch ────────────────────────────────────────────────
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 20);

-- ── 2. Discount carried into store inventory ──────────────────────────────────
ALTER TABLE public.store_inventory
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 20);

-- ── 3. Doctors table ─────────────────────────────────────────────────────────
--    Universal like medicines — any admin can add, all see them in billing search
CREATE TABLE IF NOT EXISTS public.doctors (
  id           uuid         NOT NULL DEFAULT gen_random_uuid(),
  name         varchar(200) NOT NULL,
  speciality   varchar(150) NULL,
  clinic_name  varchar(200) NULL,
  phone        varchar(20)  NULL,
  city         varchar(100) NULL,
  is_active    boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT doctors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_doctors_name ON public.doctors(name);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.doctors
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 4. Add referred_by to bills ──────────────────────────────────────────────
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS referred_by uuid NULL REFERENCES public.doctors(id) ON DELETE SET NULL;

-- ── 5. Payment split on bills ────────────────────────────────────────────────
--    Allows mixed-payment (e.g. ₹200 cash + ₹300 UPI)
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS cash_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upi_amount    numeric(12,2) NOT NULL DEFAULT 0;

-- ── 6. Add discount_percent snapshot to bill_items ───────────────────────────
ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;

-- ── 7. Index for doctor referral stats ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bills_referred_by ON public.bills(referred_by);
