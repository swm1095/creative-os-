-- UGC Team creators table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.creators (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text,
  email text,
  address text,
  portfolio_url text,
  color text DEFAULT '#2138ff',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creators_brand ON public.creators(brand_id);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all creators" ON public.creators FOR ALL USING (true);
