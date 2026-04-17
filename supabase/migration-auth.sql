-- Client users table for login system
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  email text,
  role text DEFAULT 'client',  -- 'admin', 'team', 'client'
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  last_login timestamptz,
  login_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_users_username ON public.client_users(username);
CREATE INDEX IF NOT EXISTS idx_client_users_role ON public.client_users(role);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all client_users" ON public.client_users FOR ALL USING (true);

-- Insert Sam as admin
INSERT INTO public.client_users (username, password_hash, name, email, role)
VALUES ('sam@hype10agency.com', 'admin', 'Sam Wolf', 'sam@hype10agency.com', 'admin')
ON CONFLICT (username) DO NOTHING;
