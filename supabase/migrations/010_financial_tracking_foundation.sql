-- ============================================================
-- MishraCare — Migration 010: Financial Tracking Foundation
--
-- PURPOSE: Lay the groundwork for complete cost/revenue/profit
-- tracking across the entire chain. Nothing is computed here —
-- all analytics will be derived from these tables by the app.
--
-- WHAT ALREADY EXISTS (do NOT recreate):
--   ✓ admins, stores, store_managers, employees          (001, 003, 007)
--   ✓ medicines, medicine_batches                        (004, 005, 009)
--   ✓ store_inventory, stock_transfers, stock_transfer_items (006)
--   ✓ bills, bill_items                                  (008)
--   ✓ expenses (store + admin level)                     (008)
--   ✓ transfer_issue_resolutions                         (007)
--
-- WHAT THIS MIGRATION ADDS:
--   1.  Columns on bills          → admin_id, region tracking
--   2.  Columns on expenses       → expense_type, payment_method, paid_by
--   3.  salary_payments table     → all salary disbursements (managers + employees)
--   4.  inventory_purchase_orders → formal PO record per stockist bill submission
--   5.  stock_adjustments         → manual stock corrections (damage, loss, audit diff)
--   6.  defect_reports            → detailed defect/damage/loss events per batch
--   7.  store_daily_summary       → optional pre-agg per store per day (speeds up analytics)
--   8.  admin_region_summary      → optional pre-agg per admin per month
--
-- FINANCIAL FLOW THIS ENABLES:
--
--   INCOME SIDE:
--     bills (store sales)
--       └─ bill_items (per medicine per sale)
--
--   COST SIDE:
--     inventory_purchase_orders  (what admin paid stockist)
--       └─ medicine_batches      (individual batches inside that PO)
--     salary_payments            (staff cost per store / admin)
--     expenses                   (rent, utilities, transport, marketing…)
--     defect_reports             (value of goods lost/damaged)
--     stock_adjustments          (shrinkage, write-offs)
--
--   REGION/CHAIN:
--     bills.admin_id             (which admin's region did this sale come from)
--     store_daily_summary        (roll-up for fast dashboard cards)
--     admin_region_summary       (roll-up per admin per month)
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Enrich bills with admin/region tracking
--    (bills already has store_id; this links it to the region)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS admin_id uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL;

-- Index for per-admin revenue queries
CREATE INDEX IF NOT EXISTS idx_bills_admin ON public.bills(admin_id);


-- ─────────────────────────────────────────────────────────────
-- 2. Enrich expenses with more granular tracking
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.expenses
  -- Who physically made the payment (manager or admin)
  ADD COLUMN IF NOT EXISTS paid_by_role  varchar(20) NULL,  -- admin | store_manager
  ADD COLUMN IF NOT EXISTS paid_by_id    uuid        NULL,

  -- How it was paid
  ADD COLUMN IF NOT EXISTS payment_method varchar(20) NULL DEFAULT 'cash',
    -- cash | upi | bank_transfer | card | cheque

  -- Whether it's been approved/verified by admin
  ADD COLUMN IF NOT EXISTS verified      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by   uuid        NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at   timestamptz NULL;


-- ─────────────────────────────────────────────────────────────
-- 3. salary_payments — every salary disbursement
--    Tracks: who was paid, how much, for which period, from which store/admin budget
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Who was paid
  recipient_type  varchar(20)   NOT NULL,  -- store_manager | employee
  recipient_id    uuid          NOT NULL,  -- points to store_managers.id or employees.id

  -- From which budget
  store_id        uuid          NULL REFERENCES public.stores(id) ON DELETE SET NULL,
  admin_id        uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,

  -- Payment details
  amount          numeric(10,2) NOT NULL,
  payment_date    date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method  varchar(20)   NOT NULL DEFAULT 'cash',
    -- cash | upi | bank_transfer | cheque

  -- Period this covers
  period_month    smallint      NOT NULL,  -- 1–12
  period_year     smallint      NOT NULL,

  -- Deductions
  deduction_amount  numeric(10,2) NOT NULL DEFAULT 0,
  deduction_reason  text          NULL,

  -- Net paid
  net_amount      numeric(10,2) GENERATED ALWAYS AS (amount - deduction_amount) STORED,

  -- Verification
  verified        boolean       NOT NULL DEFAULT false,
  verified_by     uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,

  notes           text          NULL,
  proof_url       text          NULL,   -- payment screenshot / receipt

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT salary_payments_pkey PRIMARY KEY (id),
  CONSTRAINT salary_recipient_type_check CHECK (recipient_type IN ('store_manager','employee'))
);

CREATE INDEX IF NOT EXISTS idx_salary_recipient   ON public.salary_payments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_salary_store        ON public.salary_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_salary_admin        ON public.salary_payments(admin_id);
CREATE INDEX IF NOT EXISTS idx_salary_period       ON public.salary_payments(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_salary_date         ON public.salary_payments(payment_date);

CREATE TRIGGER salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.salary_payments
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 4. inventory_purchase_orders — formal PO per stockist submission
--    One PO = one stockist bill = one BillSubmitModal submission
--    Many medicine_batches belong to one PO
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Who submitted
  admin_id        uuid          NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,

  -- Stockist / supplier details
  supplier_name   varchar(200)  NULL,
  supplier_invoice varchar(100) NULL,
  purchase_date   date          NOT NULL DEFAULT CURRENT_DATE,

  -- Bill
  bill_image_url  text          NOT NULL,   -- stockist bill scan
  bill_amount     numeric(12,2) NOT NULL,   -- total as on bill

  -- Computed totals (set by app when PO is created)
  total_batches   integer       NOT NULL DEFAULT 0,
  total_units     integer       NOT NULL DEFAULT 0,
  calculated_cost numeric(12,2) NOT NULL DEFAULT 0,  -- sum of (cost_per_pack × packs) across batches

  -- Approval workflow
  status          varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | partial
  reviewed_by     uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  reviewed_at     timestamptz   NULL,
  review_note     text          NULL,

  notes           text          NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT ipo_pkey PRIMARY KEY (id),
  CONSTRAINT ipo_status_check CHECK (status IN ('pending','approved','rejected','partial'))
);

CREATE INDEX IF NOT EXISTS idx_ipo_admin    ON public.inventory_purchase_orders(admin_id);
CREATE INDEX IF NOT EXISTS idx_ipo_status   ON public.inventory_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_ipo_date     ON public.inventory_purchase_orders(purchase_date);

CREATE TRIGGER ipo_updated_at
  BEFORE UPDATE ON public.inventory_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.inventory_purchase_orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Link medicine_batches back to their PO
ALTER TABLE public.medicine_batches
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid NULL
    REFERENCES public.inventory_purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_batches_po ON public.medicine_batches(purchase_order_id);


-- ─────────────────────────────────────────────────────────────
-- 5. stock_adjustments — manual corrections to store inventory
--    Examples: physical audit finds 5 less tablets, item damaged in store,
--              write-off of expired stock, correction after billing error
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),

  store_id            uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  store_inventory_id  uuid          NOT NULL REFERENCES public.store_inventory(id) ON DELETE CASCADE,
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id),
  adjusted_by         uuid          NULL REFERENCES public.store_managers(id) ON DELETE SET NULL,
  approved_by         uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,

  -- The change (positive = stock added, negative = stock removed)
  units_before        integer       NOT NULL,
  units_change        integer       NOT NULL,  -- can be negative
  units_after         integer       NOT NULL,

  adjustment_type     varchar(30)   NOT NULL,
    -- audit_correction | damage | expiry_write_off | theft | return | billing_error | other
  reason              text          NOT NULL,

  -- Financial impact (for P&L)
  cost_per_unit       numeric(10,4) NULL,   -- cost of each adjusted unit
  total_value_impact  numeric(12,2) GENERATED ALWAYS AS (
    ROUND((units_change * COALESCE(cost_per_unit, 0))::numeric, 2)
  ) STORED,  -- negative = loss to company

  proof_url           text          NULL,
  status              varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected
  approved_at         timestamptz   NULL,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT stock_adj_pkey PRIMARY KEY (id),
  CONSTRAINT adj_type_check CHECK (
    adjustment_type IN ('audit_correction','damage','expiry_write_off','theft','return','billing_error','other')
  ),
  CONSTRAINT adj_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_adj_store    ON public.stock_adjustments(store_id);
CREATE INDEX IF NOT EXISTS idx_adj_medicine ON public.stock_adjustments(medicine_id);
CREATE INDEX IF NOT EXISTS idx_adj_type     ON public.stock_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_adj_date     ON public.stock_adjustments(created_at);

CREATE TRIGGER stock_adj_updated_at
  BEFORE UPDATE ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.stock_adjustments
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 6. defect_reports — detailed record of every defect/loss event
--    Separate from transfer issues (those are in-transit defects).
--    This covers: in-store damage, expired stock, theft, storage failures.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defect_reports (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),

  store_id            uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  admin_id            uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id),
  batch_id            uuid          NULL REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  store_inventory_id  uuid          NULL REFERENCES public.store_inventory(id) ON DELETE SET NULL,
  reported_by         uuid          NULL REFERENCES public.store_managers(id) ON DELETE SET NULL,

  -- What happened
  defect_type         varchar(30)   NOT NULL,
    -- damaged | expired | theft | storage_failure | transit_damage | other
  description         text          NOT NULL,
  units_affected      integer       NOT NULL,
  batch_number        varchar(100)  NULL,
  expiry_date         date          NULL,

  -- Financial impact
  cost_per_unit       numeric(10,4) NULL,
  mrp_per_unit        numeric(10,4) NULL,
  total_cost_lost     numeric(12,2) GENERATED ALWAYS AS (
    ROUND((units_affected * COALESCE(cost_per_unit, 0))::numeric, 2)
  ) STORED,
  total_mrp_lost      numeric(12,2) GENERATED ALWAYS AS (
    ROUND((units_affected * COALESCE(mrp_per_unit, 0))::numeric, 2)
  ) STORED,

  -- Evidence
  photo_url           text          NULL,

  -- Resolution
  status              varchar(20)   NOT NULL DEFAULT 'open',
    -- open | acknowledged | written_off | replaced | recovered
  admin_response      text          NULL,
  resolved_at         timestamptz   NULL,

  reported_at         date          NOT NULL DEFAULT CURRENT_DATE,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT defect_reports_pkey PRIMARY KEY (id),
  CONSTRAINT defect_type_check CHECK (
    defect_type IN ('damaged','expired','theft','storage_failure','transit_damage','other')
  ),
  CONSTRAINT defect_status_check CHECK (
    status IN ('open','acknowledged','written_off','replaced','recovered')
  )
);

CREATE INDEX IF NOT EXISTS idx_defects_store   ON public.defect_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_defects_admin   ON public.defect_reports(admin_id);
CREATE INDEX IF NOT EXISTS idx_defects_type    ON public.defect_reports(defect_type);
CREATE INDEX IF NOT EXISTS idx_defects_status  ON public.defect_reports(status);
CREATE INDEX IF NOT EXISTS idx_defects_date    ON public.defect_reports(reported_at);

CREATE TRIGGER defect_reports_updated_at
  BEFORE UPDATE ON public.defect_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.defect_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.defect_reports
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 7. store_daily_summary — pre-aggregated per store per day
--    Populated by the app after each billing session (or via a
--    scheduled function later). Enables fast dashboard queries
--    without scanning all bills.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_daily_summary (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  admin_id        uuid          NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  summary_date    date          NOT NULL,

  -- Sales
  total_bills       integer       NOT NULL DEFAULT 0,
  gross_revenue     numeric(12,2) NOT NULL DEFAULT 0,  -- sum of bill.total_amount
  total_discount    numeric(12,2) NOT NULL DEFAULT 0,
  total_cost_of_goods numeric(12,2) NOT NULL DEFAULT 0,  -- sum of bill.total_cost
  gross_profit      numeric(12,2) GENERATED ALWAYS AS (gross_revenue - total_cost_of_goods) STORED,

  -- Expenses for the day
  total_expenses    numeric(12,2) NOT NULL DEFAULT 0,

  -- Net profit = gross_profit - expenses
  net_profit        numeric(12,2) GENERATED ALWAYS AS (
    (gross_revenue - total_cost_of_goods) - total_expenses
  ) STORED,

  -- Defects
  defect_units      integer       NOT NULL DEFAULT 0,
  defect_value      numeric(12,2) NOT NULL DEFAULT 0,

  -- Payment breakdown
  cash_collected    numeric(12,2) NOT NULL DEFAULT 0,
  upi_collected     numeric(12,2) NOT NULL DEFAULT 0,
  card_collected    numeric(12,2) NOT NULL DEFAULT 0,
  credit_collected  numeric(12,2) NOT NULL DEFAULT 0,

  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT store_daily_pkey PRIMARY KEY (id),
  CONSTRAINT store_daily_unique UNIQUE (store_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_store  ON public.store_daily_summary(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_admin  ON public.store_daily_summary(admin_id);
CREATE INDEX IF NOT EXISTS idx_daily_date   ON public.store_daily_summary(summary_date);

CREATE TRIGGER store_daily_updated_at
  BEFORE UPDATE ON public.store_daily_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.store_daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.store_daily_summary
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 8. admin_region_monthly_summary — pre-aggregated per admin per month
--    Rolled up from store_daily_summary. Enables chain-wide P&L
--    and region vs region comparisons.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_region_monthly_summary (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  admin_id        uuid          NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  summary_month   smallint      NOT NULL,  -- 1–12
  summary_year    smallint      NOT NULL,

  -- Stores in this region
  active_stores   integer       NOT NULL DEFAULT 0,

  -- Revenue
  gross_revenue   numeric(14,2) NOT NULL DEFAULT 0,
  total_discount  numeric(14,2) NOT NULL DEFAULT 0,
  net_revenue     numeric(14,2) GENERATED ALWAYS AS (gross_revenue - total_discount) STORED,

  -- Costs
  cost_of_goods   numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses  numeric(14,2) NOT NULL DEFAULT 0,
  salary_paid     numeric(14,2) NOT NULL DEFAULT 0,
  inventory_spend numeric(14,2) NOT NULL DEFAULT 0,  -- total PO value approved this month

  -- Gross + Net
  gross_profit    numeric(14,2) GENERATED ALWAYS AS (gross_revenue - cost_of_goods) STORED,
  net_profit      numeric(14,2) GENERATED ALWAYS AS (
    (gross_revenue - cost_of_goods) - total_expenses - salary_paid
  ) STORED,

  -- Quality
  total_defect_units  integer   NOT NULL DEFAULT 0,
  total_defect_value  numeric(14,2) NOT NULL DEFAULT 0,
  defect_rate_pct     numeric(6,2) NULL,  -- app calculates and stores: defect_units / units_sold * 100

  -- Bills
  total_bills     integer       NOT NULL DEFAULT 0,
  avg_bill_value  numeric(10,2) NULL,

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT arm_summary_pkey PRIMARY KEY (id),
  CONSTRAINT arm_summary_unique UNIQUE (admin_id, summary_year, summary_month)
);

CREATE INDEX IF NOT EXISTS idx_arm_admin  ON public.admin_region_monthly_summary(admin_id);
CREATE INDEX IF NOT EXISTS idx_arm_period ON public.admin_region_monthly_summary(summary_year, summary_month);

CREATE TRIGGER arm_summary_updated_at
  BEFORE UPDATE ON public.admin_region_monthly_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.admin_region_monthly_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.admin_region_monthly_summary
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- SUMMARY — what each table feeds into analytics
-- ─────────────────────────────────────────────────────────────
--
--  METRIC                         | SOURCE TABLE(S)
--  -------------------------------|----------------------------------------
--  Store daily revenue            | bills (store_id + created_at + total_amount)
--  Store gross profit             | bills (gross_profit generated column)
--  Store net profit               | bills.gross_profit - expenses - salary_payments
--  Admin region revenue           | bills JOIN stores ON stores.admin_id
--  Admin region net profit        | above - expenses - salary_payments - defect_reports
--  Overall chain revenue          | bills (all)
--  Overall chain profit           | bills - expenses - salary_payments - defect_reports
--  Cost of inventory purchased    | inventory_purchase_orders (approved, by admin/date)
--  Inventory cost per batch       | medicine_batches (cost_price_per_pack × quantity_packs)
--  Defect rate (%)                | defect_reports.units_affected / bill_items.quantity_units
--  Stock shrinkage value          | stock_adjustments.total_value_impact (where negative)
--  Salary cost per store          | salary_payments (store_id + period)
--  Salary cost per region         | salary_payments (admin_id + period)
--  Transfer defect rate           | stock_transfer_items (item_status=defect|missing|short)
--  Payment method breakdown       | bills (payment_method)
--  Top selling medicines          | bill_items (SUM quantity_units GROUP BY medicine_id)
--  Slow-moving stock              | store_inventory (units_remaining / units_received high ratio)
--  Expiry write-off loss          | defect_reports (defect_type=expired) OR stock_adjustments (expiry_write_off)
--  Fast dashboard (store)         | store_daily_summary
--  Fast dashboard (admin region)  | admin_region_monthly_summary
-- ─────────────────────────────────────────────────────────────
