-- Cache last scan results on the brand record so they persist across navigation
-- Run in Supabase SQL Editor

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_scan_insights jsonb;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_scan_trends jsonb;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_scan_sources jsonb;
