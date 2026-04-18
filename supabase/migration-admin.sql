-- Admin usage tracking + leadership access
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_email text,
  user_name text,
  service text NOT NULL,  -- 'anthropic', 'gemini', 'fal', 'apify'
  action text NOT NULL,   -- 'chat', 'copy', 'ugc_script', 'image_gen', 'video_gen', 'scan', 'research'
  tokens_in integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  estimated_cost numeric(10,6) DEFAULT 0,
  brand_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON public.usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_service ON public.usage_logs(service);
CREATE INDEX IF NOT EXISTS idx_usage_logs_email ON public.usage_logs(user_email);

CREATE TABLE IF NOT EXISTS public.admin_emails (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  can_view_usage boolean DEFAULT true,
  receives_alerts boolean DEFAULT true,
  added_by text,
  created_at timestamptz DEFAULT now()
);

-- Seed Sam as admin
INSERT INTO public.admin_emails (email, name, can_view_usage, receives_alerts, added_by)
VALUES ('sam@hype10agency.com', 'Sam Wolf', true, true, 'system')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all usage_logs" ON public.usage_logs FOR ALL USING (true);
CREATE POLICY "Allow all admin_emails" ON public.admin_emails FOR ALL USING (true);
