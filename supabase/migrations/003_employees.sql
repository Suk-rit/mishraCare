-- ============================================================
-- JanSwasthya — Store Employees / Helpers
-- Submitted by store manager, approved/rejected by admin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id            uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  submitted_by        uuid          NOT NULL REFERENCES public.store_managers(id) ON DELETE CASCADE,

  -- Personal
  full_name           varchar(150)  NOT NULL,
  phone               varchar(20)   NOT NULL,
  alternate_phone     varchar(20)   NULL,
  date_of_birth       date          NULL,
  gender              varchar(20)   NULL,
  email               varchar(255)  NULL,

  -- Identity
  aadhar_number       varchar(20)   NULL,
  pan_number          varchar(20)   NULL,

  -- Address
  address             text          NULL,
  city                varchar(100)  NULL,
  state               varchar(100)  NULL,
  pincode             varchar(10)   NULL,

  -- Role & Employment
  designation         varchar(100)  NOT NULL DEFAULT 'Helper',
  employment_type     varchar(30)   NOT NULL DEFAULT 'full_time',
  joining_date        date          NULL DEFAULT CURRENT_DATE,
  salary              numeric(10,2) NULL,
  salary_type         varchar(20)   NOT NULL DEFAULT 'monthly',
  shift               varchar(30)   NULL DEFAULT 'day',   -- day / night / flexible

  -- Documents (Supabase storage URLs)
  photo_url           text          NULL,
  aadhar_photo_url    text          NULL,
  id_proof_url        text          NULL,
  other_doc_url       text          NULL,

  -- Approval workflow
  status              varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected
  admin_note          text          NULL,   -- rejection reason or note from admin
  reviewed_at         timestamptz   NULL,

  -- Status
  is_active           boolean       NOT NULL DEFAULT false,
    -- only becomes true once approved

  -- Meta
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_status_check CHECK (status IN ('pending','approved','rejected'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_store_id      ON public.employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_submitted_by  ON public.employees(submitted_by);
CREATE INDEX IF NOT EXISTS idx_employees_status        ON public.employees(status);

-- Auto-update updated_at
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.employees
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Storage bucket for employee documents ──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents', 'employee-documents', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon uploads employee-docs" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Allow anon reads employee-docs" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'employee-documents');
