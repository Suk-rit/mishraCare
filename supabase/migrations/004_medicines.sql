-- ============================================================
-- JanSwasthya — Medicine / Product Catalog
-- Master list only — no batch/expiry/stock (those go in inventory)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.medicines (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Identity
  name                varchar(255)  NOT NULL,
  generic_name        varchar(255)  NULL,   -- salt / active ingredient
  brand               varchar(150)  NULL,   -- brand/trade name alias
  manufacturer        varchar(200)  NOT NULL,

  -- Classification
  category            varchar(100)  NOT NULL,
    -- e.g. Antibiotic, Antifungal, Vitamin, Painkiller, etc.
  type                varchar(50)   NOT NULL,
    -- Tablet | Capsule | Syrup | Injection | Drops | Cream | Ointment |
    -- Powder | Inhaler | Patch | Suppository | Lozenges | Other
  schedule            varchar(20)   NULL DEFAULT 'OTC',
    -- OTC | H | H1 | X | G | Prescription

  -- Dosage & Strength
  strength            varchar(100)  NULL,   -- e.g. "500mg", "5ml/5ml", "10IU"
  dosage_form         varchar(100)  NULL,   -- e.g. "Film-coated tablet"

  -- Package info (used for loose-unit tracking)
  pack_size           integer       NOT NULL DEFAULT 1,
    -- units in one pack — e.g. 10 (strip of 10 tablets)
  pack_unit           varchar(30)   NOT NULL DEFAULT 'tablet',
    -- tablet | capsule | ml | vial | tube | sachet | unit
  pack_label          varchar(100)  NULL,
    -- human label — e.g. "Strip of 10 tablets", "100ml bottle"

  -- Pricing (MRP)
  mrp_per_pack        numeric(10,2) NULL,   -- MRP of one full pack
  mrp_per_unit        numeric(10,4) NULL,   -- auto-compute: mrp_per_pack / pack_size

  -- Regulatory
  hsn_code            varchar(20)   NULL,   -- GST HSN code
  gst_percent         numeric(5,2)  NULL DEFAULT 12,

  -- Meta
  description         text          NULL,
  is_active           boolean       NOT NULL DEFAULT true,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT medicines_pkey PRIMARY KEY (id),
  CONSTRAINT medicines_type_check CHECK (
    type IN ('Tablet','Capsule','Syrup','Injection','Drops','Cream',
             'Ointment','Powder','Inhaler','Patch','Suppository','Lozenges','Other')
  ),
  CONSTRAINT medicines_schedule_check CHECK (
    schedule IN ('OTC','H','H1','X','G','Prescription')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medicines_name         ON public.medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON public.medicines(manufacturer);
CREATE INDEX IF NOT EXISTS idx_medicines_type         ON public.medicines(type);
CREATE INDEX IF NOT EXISTS idx_medicines_category     ON public.medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_schedule     ON public.medicines(schedule);

-- Auto-update updated_at
CREATE TRIGGER medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.medicines
  FOR ALL TO anon USING (true) WITH CHECK (true);
