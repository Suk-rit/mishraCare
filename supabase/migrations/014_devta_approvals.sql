-- ============================================================
-- MishraCare — Migration 014: Devta Approval Flows
--
-- 1. admin_team       — admin's warehouse/office staff requests (→ Devta)
-- 2. notifications    — in-app alerts for admins (e.g. new store assigned)
-- ============================================================

-- ── 1. admin_team ────────────────────────────────────────────────────────────
-- Admin can add their own warehouse/office team members.
-- Goes to Devta for approval (mirrors employees table but for admin-level staff).
CREATE TABLE IF NOT EXISTS public.admin_team (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),
  admin_id         uuid          NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,

  -- Personal
  full_name        varchar(150)  NOT NULL,
  phone            varchar(20)   NOT NULL,
  alternate_phone  varchar(20)   NULL,
  email            varchar(255)  NULL,
  date_of_birth    date          NULL,
  gender           varchar(20)   NULL,

  -- Identity
  aadhar_number    varchar(20)   NULL,
  pan_number       varchar(20)   NULL,

  -- Address
  address          text          NULL,
  city             varchar(100)  NULL,
  state            varchar(100)  NULL,
  pincode          varchar(10)   NULL,

  -- Role
  designation      varchar(100)  NOT NULL DEFAULT 'Warehouse Staff',
  employment_type  varchar(30)   NOT NULL DEFAULT 'full_time',
  joining_date     date          NULL DEFAULT CURRENT_DATE,
  salary           numeric(10,2) NULL,
  salary_type      varchar(20)   NOT NULL DEFAULT 'monthly',
  shift            varchar(30)   NULL DEFAULT 'day',

  -- Documents
  photo_url        text          NULL,
  aadhar_photo_url text          NULL,
  id_proof_url     text          NULL,
  other_doc_url    text          NULL,

  -- Approval (by Devta)
  status           varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected
  devta_note       text          NULL,
  reviewed_at      timestamptz   NULL,
  reviewed_by      uuid          NULL REFERENCES public.devta(id) ON DELETE SET NULL,

  -- Active only after approval
  is_active        boolean       NOT NULL DEFAULT false,

  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT admin_team_pkey PRIMARY KEY (id),
  CONSTRAINT admin_team_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_admin_team_admin  ON public.admin_team(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_team_status ON public.admin_team(status);

CREATE TRIGGER admin_team_updated_at
  BEFORE UPDATE ON public.admin_team
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.admin_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.admin_team
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Storage bucket for admin team documents (reuse employee-documents bucket is fine,
-- but create a dedicated one for clarity)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-team-documents', 'admin-team-documents', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anon upload admin-team-docs" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'admin-team-documents');
CREATE POLICY "Allow anon read admin-team-docs" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'admin-team-documents');


-- ── 2. notifications ─────────────────────────────────────────────────────────
-- In-app notifications for admins.
-- Currently used for: new store assigned by Devta.
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid         NOT NULL DEFAULT gen_random_uuid(),
  recipient_id uuid         NOT NULL,   -- admin.id or devta.id
  recipient_role varchar(20) NOT NULL,  -- admin | devta | store_manager
  type         varchar(50)  NOT NULL,   -- store_assigned | employee_approved | etc.
  title        varchar(200) NOT NULL,
  body         text         NULL,
  reference_id uuid         NULL,       -- e.g. store.id or employee.id
  is_read      boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_read      ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_type      ON public.notifications(type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.notifications
  FOR ALL TO anon USING (true) WITH CHECK (true);
