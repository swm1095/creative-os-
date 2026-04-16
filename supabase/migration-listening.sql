-- Signal history and saved insights for HyperListening
-- Run this in Supabase SQL Editor

-- Store signal history per brand for NEW/TRENDING detection
CREATE TABLE IF NOT EXISTS public.brand_signals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  signal_id text NOT NULL,  -- External ID (e.g. reddit post id)
  source text NOT NULL,      -- e.g. 'reddit', 'hn', 'youtube'
  source_detail text,        -- e.g. 'r/footpain'
  title text,
  content text,
  url text,
  score integer DEFAULT 0,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  appearance_count integer DEFAULT 1,
  UNIQUE(brand_id, signal_id, source)
);

CREATE INDEX IF NOT EXISTS idx_brand_signals_brand ON public.brand_signals(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_signals_last_seen ON public.brand_signals(last_seen DESC);

-- Saved insights / creative briefs
CREATE TABLE IF NOT EXISTS public.saved_insights (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  insight_type text,  -- trend, pain_point, competitor, opportunity, language
  source_data jsonb,  -- Original insight data
  notes text,
  status text DEFAULT 'idea',  -- idea, in-progress, used, archived
  priority text DEFAULT 'medium',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_insights_brand ON public.saved_insights(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_insights_status ON public.saved_insights(status);

-- Brand scan schedules and ownership
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS scan_cadence text DEFAULT 'manual';  -- manual, daily, weekly
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS assigned_to text;

-- Open RLS policies for demo
ALTER TABLE public.brand_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all signals" ON public.brand_signals FOR ALL USING (true);
CREATE POLICY "Allow all insights" ON public.saved_insights FOR ALL USING (true);
