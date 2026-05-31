-- PawLoop Production Hardening Migration (007)
-- Run this in Supabase SQL Editor BEFORE going public.
-- This fixes missing columns, hardens RLS, and ensures OTP user compatibility.

-- ═══════════════════════════════════════════════════════
-- 1. ADD MISSING COLUMNS referenced by RPCs and triggers
-- ═══════════════════════════════════════════════════════

-- profiles.volunteer_state — used by get_ecosystem_narrative() and useRealtime
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS volunteer_state TEXT DEFAULT 'available';

-- Only add the constraint if it doesn't already exist to prevent errors on multiple runs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_volunteer_state_check'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_volunteer_state_check 
      CHECK (volunteer_state IN ('available', 'on_mission', 'offline', 'resting'));
  END IF;
END $$;

-- *.updated_by — used by audit triggers in 005_security_and_analytics_rpc.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- stations.health_score — used by get_ecosystem_narrative() in 006
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 50;


-- ═══════════════════════════════════════════════════════
-- 2. FIX REPORTS RLS — Require authentication for inserts
--    Previously: WITH CHECK (true) — anyone/bots can spam
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;

CREATE POLICY "Authenticated users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ═══════════════════════════════════════════════════════
-- 3. INDEXES for production query performance
-- ═══════════════════════════════════════════════════════

-- Rate limiting: look up recent reports by reporter
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created 
  ON public.reports (reported_by, created_at DESC);

-- Fast volunteer state lookups for RPCs
CREATE INDEX IF NOT EXISTS idx_profiles_volunteer_state
  ON public.profiles (volunteer_state);


-- ═══════════════════════════════════════════════════════
-- 4. FIX USER TRIGGER for Email OTP signups
--    Email OTP users don't have full_name or avatar_url
--    in raw_user_meta_data. Fallback to email prefix.
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email::text, '@', 1),
      'Community Member'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
