-- ============================================================
-- MishraCare — Admin hierarchy + issue resolution
-- ============================================================

-- Add region/location to admins
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS region      varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS city        varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS state       varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS designation varchar(100) NULL DEFAULT 'Area Admin';

-- Link stores to admins (nullable so existing stores don't break)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS admin_id uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_admin ON public.stores(admin_id);

-- ── Transfer Issue Resolution ──────────────────────────────────
-- When a store manager reports an issue, admin can respond here
CREATE TABLE IF NOT EXISTS public.transfer_issue_resolutions (
  id              uuid         NOT NULL DEFAULT gen_random_uuid(),
  transfer_id     uuid         NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  transfer_item_id uuid        NULL     REFERENCES public.stock_transfer_items(id) ON DELETE SET NULL,

  -- Who raised + who resolved
  raised_by_store uuid         NOT NULL REFERENCES public.stores(id),
  resolved_by_admin uuid       NULL     REFERENCES public.admins(id),

  -- Issue details (copied from transfer item for quick reference)
  issue_type      varchar(30)  NOT NULL, -- defect | missing | short
  item_name       varchar(255) NULL,
  batch_number    varchar(100) NULL,
  units_affected  integer      NULL,
  manager_note    text         NULL,

  -- Resolution
  status          varchar(20)  NOT NULL DEFAULT 'open',
    -- open | acknowledged | resolved | replacement_sent | refund_issued | no_action
  admin_response  text         NULL,
  resolved_at     timestamptz  NULL,

  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT issue_res_pkey PRIMARY KEY (id),
  CONSTRAINT issue_status_check CHECK (
    status IN ('open','acknowledged','resolved','replacement_sent','refund_issued','no_action')
  )
);

CREATE INDEX IF NOT EXISTS idx_issues_transfer ON public.transfer_issue_resolutions(transfer_id);
CREATE INDEX IF NOT EXISTS idx_issues_store    ON public.transfer_issue_resolutions(raised_by_store);
CREATE INDEX IF NOT EXISTS idx_issues_status   ON public.transfer_issue_resolutions(status);

CREATE TRIGGER issue_res_updated_at
  BEFORE UPDATE ON public.transfer_issue_resolutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.transfer_issue_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.transfer_issue_resolutions
  FOR ALL TO anon USING (true) WITH CHECK (true);
