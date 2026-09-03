-- Internal Team Table for Vishnu's core team members
-- This table stores internal team members with complete financial and personal details

CREATE TABLE IF NOT EXISTS public.internal_team (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  designation VARCHAR(150) NOT NULL,
  salary DECIMAL(10,2) DEFAULT 0,
  
  -- Bank Details
  bank_holder_name VARCHAR(150),
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(30),
  bank_ifsc VARCHAR(20),
  bank_branch VARCHAR(100),
  upi_id VARCHAR(100),
  
  -- Contact Information
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(150),
  
  -- Document URLs
  aadhar_photo_url TEXT,
  pan_photo_url TEXT,
  id_proof_url TEXT,
  other_doc_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_internal_team_active ON public.internal_team(is_active);
CREATE INDEX IF NOT EXISTS idx_internal_team_created_at ON public.internal_team(created_at DESC);

-- Create storage bucket for internal team documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('internal-team-docs', 'internal-team-docs', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for internal team documents
CREATE POLICY "Allow anon upload internal-team-docs" ON storage.objects FOR INSERT TO anon 
WITH CHECK (bucket_id = 'internal-team-docs');

CREATE POLICY "Allow anon read internal-team-docs" ON storage.objects FOR SELECT TO anon 
USING (bucket_id = 'internal-team-docs');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_internal_team_updated_at 
BEFORE UPDATE ON public.internal_team 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
