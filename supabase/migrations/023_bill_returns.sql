-- Migration 023: Bill Returns Tracking
-- This table tracks customer returns to prevent duplicate returns and for analytics

CREATE TABLE IF NOT EXISTS public.bill_returns (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  bill_id         uuid          NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  store_id        uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  returned_by     uuid          NULL REFERENCES public.store_managers(id),
  
  -- Financial tracking
  refund_amount   numeric(12,2) NOT NULL,
  refund_includes_gst boolean NOT NULL DEFAULT false,
  
  -- Return details
  return_date     timestamptz   NOT NULL DEFAULT now(),
  notes           text          NULL,
  
  -- Status tracking
  status          varchar(20)   NOT NULL DEFAULT 'completed',
    -- completed | cancelled | partial
  
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bill_returns_pkey PRIMARY KEY (id),
  CONSTRAINT bill_returns_bill_unique UNIQUE (bill_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_returns_bill     ON public.bill_returns(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_returns_store    ON public.bill_returns(store_id);
CREATE INDEX IF NOT EXISTS idx_bill_returns_date     ON public.bill_returns(return_date);

CREATE TRIGGER bill_returns_updated_at
  BEFORE UPDATE ON public.bill_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.bill_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.bill_returns
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Bill Return Items (tracks which items were returned and in what quantity)
CREATE TABLE IF NOT EXISTS public.bill_return_items (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  bill_return_id      uuid          NOT NULL REFERENCES public.bill_returns(id) ON DELETE CASCADE,
  bill_item_id        uuid          NOT NULL REFERENCES public.bill_items(id) ON DELETE CASCADE,
  medicine_id         uuid          NOT NULL REFERENCES public.medicines(id),
  
  -- Return details
  quantity_returned   int           NOT NULL,
  refund_amount       numeric(12,2) NOT NULL,
  
  created_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bill_return_items_pkey PRIMARY KEY (id),
  CONSTRAINT bill_return_items_item_return_unique UNIQUE (bill_return_id, bill_item_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_return_items_return ON public.bill_return_items(bill_return_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_item   ON public.bill_return_items(bill_item_id);

ALTER TABLE public.bill_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.bill_return_items
  FOR ALL TO anon USING (true) WITH CHECK (true);
