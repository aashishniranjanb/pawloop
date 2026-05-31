-- PawLoop Phase 1 — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

-- ═══════════════════════════════════════════════════════
-- PROFILES (extends auth.users)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'volunteer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════
-- STATIONS (Feeding, Water, Shelter, Waste nodes)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES public.profiles(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feeding', 'water', 'shelter', 'waste')),
  animal_type TEXT NOT NULL CHECK (animal_type IN ('dog', 'cat', 'bird', 'cow', 'mixed')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'needs_refill', 'needs_cleanup', 'inactive')),
  water_level TEXT CHECK (water_level IN ('full', 'half', 'empty')),
  cleanliness INTEGER DEFAULT 5 CHECK (cleanliness BETWEEN 1 AND 5),
  notes TEXT,
  image_url TEXT,
  last_refill TIMESTAMPTZ,
  volunteer_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- UPDATES (Activity log for stations)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('refilled', 'cleaned', 'reported_issue', 'status_change', 'created')),
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- REPORTS (Animal reports)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by UUID REFERENCES public.profiles(id),
  animal_type TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('injured', 'hungry', 'aggressive', 'sick')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  notes TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════

-- Profiles: public read, own write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Stations: public read, authenticated create/update
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stations are viewable by everyone"
  ON public.stations FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create stations"
  ON public.stations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Station creators and volunteers can update"
  ON public.stations FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = volunteer_id);

-- Updates: public read, authenticated create
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Updates are viewable by everyone"
  ON public.updates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create updates"
  ON public.updates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Reports: public read, anyone can create (auth optional)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports are viewable by everyone"
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Report creators can update"
  ON public.reports FOR UPDATE
  USING (auth.uid() = reported_by);

-- ═══════════════════════════════════════════════════════
-- REALTIME (enable for activity feed)
-- ═══════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_stations_location ON public.stations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_stations_type ON public.stations (type);
CREATE INDEX IF NOT EXISTS idx_stations_status ON public.stations (status);
CREATE INDEX IF NOT EXISTS idx_updates_station ON public.updates (station_id);
CREATE INDEX IF NOT EXISTS idx_updates_created ON public.updates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports (lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);
