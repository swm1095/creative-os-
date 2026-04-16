-- Competitor research cache
-- Run in Supabase SQL Editor

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS competitor_research jsonb;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS competitor_research_date timestamptz;
