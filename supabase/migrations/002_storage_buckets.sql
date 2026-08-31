-- ── Storage Buckets for MishraCare documents ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('store-documents',  'store-documents',  true, 10485760, -- 10MB
   ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('manager-documents','manager-documents',true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Allow anon to upload and read
CREATE POLICY "Allow anon uploads store-docs" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'store-documents');

CREATE POLICY "Allow anon reads store-docs" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'store-documents');

CREATE POLICY "Allow anon uploads manager-docs" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'manager-documents');

CREATE POLICY "Allow anon reads manager-docs" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'manager-documents');
