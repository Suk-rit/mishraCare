-- ============================================================
-- JanSwasthya — Stock Transfers + Store Inventory
-- ============================================================

-- ── Store Inventory ───────────────────────────────────────────
-- Per-store stock. Created/updated when admin transfers are confirmed.
CREATE TABLE IF NOT EXISTS public.store_inventory (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  medicine_id     uuid          NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,

  -- Batch identity (kept from the original admin batch for traceability)
  batch_number    varchar(100)  NOT NULL,
  date_of_manufacture date      NULL,
  expiry_date     date          NOT NULL,
  mrp_per_pack    numeric(10,2) NULL,
  cost_price_per_pack numeric(10,2) NULL,

  -- Quantity
  units_received  integer       NOT NULL DEFAULT 0,
  units_remaining integer       NOT NULL DEFAULT 0,   -- decremented on sale

  -- Traceability
  transfer_item_id uuid         NULL,   -- FK set after table created below

  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT store_inventory_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sinv_store      ON public.store_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_sinv_medicine   ON public.store_inventory(medicine_id);
CREATE INDEX IF NOT EXISTS idx_sinv_expiry     ON public.store_inventory(expiry_date);

CREATE TRIGGER store_inventory_updated_at
  BEFORE UPDATE ON public.store_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.store_inventory
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Stock Transfers (header) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  -- status: draft → dispatched → received | partially_received | issue_reported
  status          varchar(30)   NOT NULL DEFAULT 'dispatched',
  dispatched_at   timestamptz   NULL DEFAULT now(),
  received_at     timestamptz   NULL,

  admin_notes     text          NULL,
  manager_notes   text          NULL,   -- overall note from manager on receipt

  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT stock_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT transfers_status_check CHECK (
    status IN ('dispatched','received','partially_received','issue_reported','cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_transfers_store  ON public.stock_transfers(store_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.stock_transfers(status);

CREATE TRIGGER stock_transfers_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.stock_transfers
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Stock Transfer Items (line items) ────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  transfer_id         uuid          NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id),
  batch_id            uuid          NOT NULL REFERENCES public.medicine_batches(id),

  -- Sent by admin
  quantity_units_sent integer       NOT NULL,   -- units (not packs)

  -- Reported by store manager on inspection
  quantity_units_received integer   NULL,        -- actual received
  item_status         varchar(20)   NOT NULL DEFAULT 'pending',
    -- pending | ok | defect | missing | short
  defect_note         text          NULL,

  -- Snapshot of batch info at transfer time (for traceability)
  batch_number        varchar(100)  NOT NULL,
  expiry_date         date          NOT NULL,
  date_of_manufacture date          NULL,
  mrp_per_pack        numeric(10,2) NULL,
  cost_price_per_pack numeric(10,2) NULL,
  pack_size           integer       NOT NULL DEFAULT 1,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT transfer_items_pkey PRIMARY KEY (id),
  CONSTRAINT item_status_check CHECK (
    item_status IN ('pending','ok','defect','missing','short')
  )
);

CREATE INDEX IF NOT EXISTS idx_ti_transfer  ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_ti_medicine  ON public.stock_transfer_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_ti_batch     ON public.stock_transfer_items(batch_id);

CREATE TRIGGER stock_transfer_items_updated_at
  BEFORE UPDATE ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.stock_transfer_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add FK from store_inventory back to transfer_items
ALTER TABLE public.store_inventory
  ADD CONSTRAINT fk_sinv_transfer_item
  FOREIGN KEY (transfer_item_id) REFERENCES public.stock_transfer_items(id) ON DELETE SET NULL;
