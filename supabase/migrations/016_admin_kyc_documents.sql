-- ============================================================
-- MishraCare — Migration 016: Admin KYC Documents
-- Adds identity + document fields to admins table.
-- These are visible to Vishnu only.
-- ============================================================

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS aadhar_number    varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS pan_number       varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth    date         NULL,
  ADD COLUMN IF NOT EXISTS permanent_address text        NULL,

  -- Document URLs (stored in admin-documents bucket)
  ADD COLUMN IF NOT EXISTS photo_url        text         NULL,   -- profile photo
  ADD COLUMN IF NOT EXISTS aadhar_photo_url text         NULL,   -- aadhar card scan
  ADD COLUMN IF NOT EXISTS pan_photo_url    text         NULL,   -- PAN card scan
  ADD COLUMN IF NOT EXISTS id_proof_url     text         NULL,   -- any other govt ID
  ADD COLUMN IF NOT EXISTS other_doc_url    text         NULL;   -- additional document

-- Storage bucket for admin documents (private to Vishnu)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-documents',
  'admin-documents',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon upload admin-documents" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'admin-documents');
CREATE POLICY "Allow anon read admin-documents" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'admin-documents');
