-- ============================================================
-- MishraCare — Migration 009: Batch Approval Flow
-- 
-- What exists already (DO NOT recreate):
--   ✓ medicines           (004_medicines.sql)
--   ✓ medicine_batches    (005_medicine_batches.sql)
--   ✓ admins              (007_hierarchy.sql references it)
--   ✓ storage buckets:    store-documents, manager-documents (002_storage_buckets.sql)
--
-- What this migration adds:
--   1. admin_id column on medicine_batches  → which admin submitted this batch
--   2. status column on medicine_batches    → pending | approved | rejected
--   3. bill_image_url column                → stockist bill uploaded on submission
--   4. stockist-bills storage bucket        → stores uploaded bill images/PDFs
-- ============================================================


-- ── 1. Alter medicine_batches: add admin_id ───────────────────
--    References admins(id). Nullable because old batches won't have it.
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS admin_id uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL;

-- ── 2. Alter medicine_batches: add approval status ────────────
--    Existing rows default to 'approved' so they continue to work.
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'approved';

--    Now add the check constraint (only if it doesn't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'medicine_batches'
      AND constraint_name = 'medicine_batches_status_check'
  ) THEN
    ALTER TABLE public.medicine_batches
      ADD CONSTRAINT medicine_batches_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ── 3. Alter medicine_batches: add bill_image_url + bill_amount ──
--    URL of the stockist bill image/PDF in Supabase Storage.
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS bill_image_url text NULL;

--    Total bill amount as entered by the admin (for reconciliation)
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS bill_amount numeric(10,2) NULL;

-- ── 4. Indexes for the new columns ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_batches_admin_id ON public.medicine_batches(admin_id);
CREATE INDEX IF NOT EXISTS idx_batches_status   ON public.medicine_batches(status);

-- ── 5. Create stockist-bills storage bucket ───────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stockist-bills',
  'stockist-bills',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the new bucket
CREATE POLICY "Allow anon uploads stockist-bills" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'stockist-bills');

CREATE POLICY "Allow anon reads stockist-bills" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'stockist-bills');
