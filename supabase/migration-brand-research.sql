-- Add brand research columns to brands table
-- Run this in Supabase SQL Editor

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS research jsonb;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS research_completed boolean DEFAULT false;
