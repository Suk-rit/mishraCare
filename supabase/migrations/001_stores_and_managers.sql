-- ============================================================
-- JanSwasthya Pharmacy ERP — Stores & Store Managers Schema
-- ============================================================

-- ── STORES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id                      uuid          NOT NULL DEFAULT gen_random_uuid(),
  
  -- Basic info
  store_name              varchar(200)  NOT NULL,
  rdl_number              varchar(100)  NOT NULL UNIQUE,  -- Retail Drug License number
  gstin                   varchar(20)   NULL,             -- GST number
  
  -- Location
  address_line1           text          NOT NULL,
  address_line2           text          NULL,
  city                    varchar(100)  NOT NULL,
  state                   varchar(100)  NOT NULL,
  pincode                 varchar(10)   NOT NULL,
  latitude                numeric(10,7) NULL,
  longitude               numeric(10,7) NULL,
  
  -- Pharmacist details
  pharmacist_name         varchar(150)  NOT NULL,
  pharmacist_registration varchar(100)  NOT NULL,         -- Pharmacy council reg no.
  pharmacist_phone        varchar(20)   NULL,
  pharmacist_degree_url   text          NULL,             -- Supabase storage URL
  
  -- Store documents
  rent_agreement_url      text          NULL,             -- Supabase storage URL
  rdl_certificate_url     text          NULL,             -- RDL certificate scan
  gst_certificate_url     text          NULL,
  noc_url                 text          NULL,             -- NOC if required
  
  -- Operational
  opening_time            time          NULL DEFAULT '09:00',
  closing_time            time          NULL DEFAULT '21:00',
  is_24_hours             boolean       NULL DEFAULT false,
  is_active               boolean       NOT NULL DEFAULT true,
  established_date        date          NULL,
  
  -- Meta
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT stores_pkey PRIMARY KEY (id)
);

-- ── STORE MANAGERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_managers (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id            uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Auth
  email               varchar(255)  NOT NULL UNIQUE,
  password            text          NOT NULL,             -- plain text for now (same as admin)
  
  -- Personal info
  full_name           varchar(150)  NOT NULL,
  phone               varchar(20)   NOT NULL,
  alternate_phone     varchar(20)   NULL,
  date_of_birth       date          NULL,
  gender              varchar(20)   NULL,                 -- Male / Female / Other
  
  -- Identity
  aadhar_number       varchar(20)   NULL UNIQUE,
  pan_number          varchar(20)   NULL UNIQUE,
  aadhar_photo_url    text          NULL,                 -- Supabase storage URL
  
  -- Address
  address             text          NULL,
  city                varchar(100)  NULL,
  state               varchar(100)  NULL,
  pincode             varchar(10)   NULL,
  
  -- Employment
  designation         varchar(100)  NULL DEFAULT 'Store Manager',
  joining_date        date          NULL DEFAULT CURRENT_DATE,
  salary              numeric(10,2) NULL,
  salary_type         varchar(20)   NULL DEFAULT 'monthly', -- monthly / weekly
  employment_type     varchar(30)   NULL DEFAULT 'full_time', -- full_time / part_time / contract
  
  -- Documents
  photo_url           text          NULL,                 -- Profile photo
  id_proof_url        text          NULL,                 -- Any govt ID
  
  -- Status
  is_active           boolean       NOT NULL DEFAULT true,
  last_login          timestamptz   NULL,
  
  -- Meta
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT store_managers_pkey PRIMARY KEY (id)
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stores_rdl        ON public.stores(rdl_number);
CREATE INDEX IF NOT EXISTS idx_stores_pincode    ON public.stores(pincode);
CREATE INDEX IF NOT EXISTS idx_sm_store_id       ON public.store_managers(store_id);
CREATE INDEX IF NOT EXISTS idx_sm_email          ON public.store_managers(email);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER store_managers_updated_at
  BEFORE UPDATE ON public.store_managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (Row Level Security) ──────────────────────────────────
ALTER TABLE public.stores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;

-- Allow anon/service role full access (admin app uses anon key with service role for management)
-- In production, tighten these policies per role.
CREATE POLICY "Allow all for anon" ON public.stores
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON public.store_managers
  FOR ALL TO anon USING (true) WITH CHECK (true);
