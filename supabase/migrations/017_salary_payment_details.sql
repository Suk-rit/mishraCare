-- ============================================================
-- JanSwasthya — Migration 017: Salary Payment Details
-- Adds salary payment mode + bank/UPI details to all staff tables:
--   admins, store_managers, employees, admin_team
-- ============================================================

-- shared columns added to all 4 tables:
--   salary_mode        — cash | bank_transfer | upi | cheque
--   bank_holder_name   — account holder name
--   bank_name          — bank name (e.g. SBI, HDFC)
--   bank_account_no    — account number
--   bank_ifsc          — IFSC code
--   bank_branch        — branch name (optional)
--   upi_id             — UPI ID (optional, used when mode = upi)

-- ── admins ────────────────────────────────────────────────────────────────────
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS salary_mode       varchar(20)  NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_holder_name  varchar(150) NULL,
  ADD COLUMN IF NOT EXISTS bank_name         varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS bank_account_no   varchar(30)  NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc         varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS bank_branch       varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS upi_id            varchar(100) NULL;

-- ── store_managers ────────────────────────────────────────────────────────────
ALTER TABLE public.store_managers
  ADD COLUMN IF NOT EXISTS salary_mode       varchar(20)  NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_holder_name  varchar(150) NULL,
  ADD COLUMN IF NOT EXISTS bank_name         varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS bank_account_no   varchar(30)  NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc         varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS bank_branch       varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS upi_id            varchar(100) NULL;

-- ── employees ─────────────────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary_mode       varchar(20)  NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_holder_name  varchar(150) NULL,
  ADD COLUMN IF NOT EXISTS bank_name         varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS bank_account_no   varchar(30)  NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc         varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS bank_branch       varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS upi_id            varchar(100) NULL;

-- ── admin_team ────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_team
  ADD COLUMN IF NOT EXISTS salary_mode       varchar(20)  NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_holder_name  varchar(150) NULL,
  ADD COLUMN IF NOT EXISTS bank_name         varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS bank_account_no   varchar(30)  NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc         varchar(20)  NULL,
  ADD COLUMN IF NOT EXISTS bank_branch       varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS upi_id            varchar(100) NULL;
