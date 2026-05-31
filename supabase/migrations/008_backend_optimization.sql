-- PawLoop Enterprise-Grade Backend Optimization (008)
-- Run this in Supabase to clean up schema types, optimize indexing, and secure RLS.

-- ═══════════════════════════════════════════════════════
-- 1. CONVERT station_id COLUMNS FROM TEXT TO UUID
-- ═══════════════════════════════════════════════════════

-- Drop foreign key constraints first to allow altering column types
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_station_id_fkey;
ALTER TABLE public.updates DROP CONSTRAINT IF EXISTS updates_station_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_station_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_station_id_fkey;
ALTER TABLE public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_station_id_fkey;

-- Alter column types
ALTER TABLE public.reports ALTER COLUMN station_id TYPE uuid USING station_id::uuid;
ALTER TABLE public.updates ALTER COLUMN station_id TYPE uuid USING station_id::uuid;
ALTER TABLE public.tasks ALTER COLUMN station_id TYPE uuid USING station_id::uuid;
ALTER TABLE public.notifications ALTER COLUMN station_id TYPE uuid USING station_id::uuid;
ALTER TABLE public.analytics_events ALTER COLUMN station_id TYPE uuid USING station_id::uuid;

-- Re-create constraints referencing public.stations(id) with proper cascade/set-null semantics
ALTER TABLE public.reports ADD CONSTRAINT reports_station_id_fkey 
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE SET NULL;

ALTER TABLE public.updates ADD CONSTRAINT updates_station_id_fkey 
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_station_id_fkey 
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_station_id_fkey 
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE SET NULL;

ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_station_id_fkey 
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════
-- 2. HARDEN USER PROFILE FOREIGN KEYS ON DELETE BEHAVIOR
-- ═══════════════════════════════════════════════════════

-- Drop existing fkeys on stations
ALTER TABLE public.stations DROP CONSTRAINT IF EXISTS stations_created_by_fkey;
ALTER TABLE public.stations DROP CONSTRAINT IF EXISTS stations_volunteer_id_fkey;
ALTER TABLE public.stations DROP CONSTRAINT IF EXISTS stations_updated_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.stations 
  ADD CONSTRAINT stations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT stations_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT stations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop existing fkeys on reports
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_by_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_updated_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.reports 
  ADD CONSTRAINT reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT reports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop and recreate fkey on updates
ALTER TABLE public.updates DROP CONSTRAINT IF EXISTS updates_user_id_fkey;
ALTER TABLE public.updates 
  ADD CONSTRAINT updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop existing fkeys on tasks
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_updated_by_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tasks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════
-- 3. PRODUCTION INDEXES FOR HEAVY WORKLOADS
-- ═══════════════════════════════════════════════════════

-- Notifications unread count and list feeds
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications (user_id) 
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications (user_id, created_at DESC);

-- Tasks assignments and statuses
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to 
  ON public.tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_tasks_station_id 
  ON public.tasks (station_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status 
  ON public.tasks (status);

-- Analytics events tracking
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created 
  ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_station 
  ON public.analytics_events (station_id) 
  WHERE station_id IS NOT NULL;

-- Push subscriptions indexing
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON public.push_subscriptions (user_id);

-- Updates user logs
CREATE INDEX IF NOT EXISTS idx_updates_user 
  ON public.updates (user_id);


-- ═══════════════════════════════════════════════════════
-- 4. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════

-- Analytics events RLS
DROP POLICY IF EXISTS "Analytics events are viewable by authenticated users." ON public.analytics_events;
DROP POLICY IF EXISTS "Authenticated users can insert analytics events." ON public.analytics_events;

CREATE POLICY "Analytics events are viewable by authenticated users."
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own analytics events."
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Reports RLS
DROP POLICY IF EXISTS "Reports are viewable by everyone." ON public.reports;
DROP POLICY IF EXISTS "Reports are viewable by everyone" ON public.reports;
DROP POLICY IF EXISTS "Anyone can create reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can create reports." ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports." ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can update reports." ON public.reports;

CREATE POLICY "Reports are viewable by everyone"
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by IS NULL OR auth.uid() = reported_by);

CREATE POLICY "Report creators and assigned volunteers can update"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = reported_by OR auth.uid() = assigned_to);

-- Updates RLS
DROP POLICY IF EXISTS "Updates are viewable by everyone." ON public.updates;
DROP POLICY IF EXISTS "Updates are viewable by everyone" ON public.updates;
DROP POLICY IF EXISTS "Authenticated users can insert updates." ON public.updates;
DROP POLICY IF EXISTS "Authenticated users can insert updates" ON public.updates;

CREATE POLICY "Updates are viewable by everyone"
  ON public.updates FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert updates"
  ON public.updates FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Tasks RLS
DROP POLICY IF EXISTS "Tasks are viewable by everyone." ON public.tasks;
DROP POLICY IF EXISTS "Tasks are viewable by everyone" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks." ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks." ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;

CREATE POLICY "Tasks are viewable by everyone"
  ON public.tasks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by IS NULL OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (true);


-- ═══════════════════════════════════════════════════════
-- 5. PREDICTIVE DIGITAL TWIN DEGRADATION ENGINE
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_ecosystem_degradation()
RETURNS integer AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  -- 1. Reduce cleanliness for stations that haven't had updates in 24 hours and have cleanliness > 1
  -- Simulates natural waste accumulation in stray feeding bowls over time
  UPDATE public.stations
  SET 
    cleanliness = GREATEST(1, cleanliness - 1),
    status = CASE 
      WHEN cleanliness - 1 <= 2 THEN 'needs_cleanup'::text 
      ELSE status 
    END,
    updated_at = now()
  WHERE status NOT IN ('archived', 'inactive')
  AND last_activity_at < (now() - interval '24 hours')
  AND cleanliness > 1;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- 2. Reduce health score for critical or empty water stations
  -- Simulates environmental dehydration risks and general structural decay
  UPDATE public.stations
  SET 
    health_score = LEAST(100, GREATEST(0, health_score - 10)),
    status = CASE 
      WHEN health_score - 10 <= 30 THEN 'critical'::text 
      ELSE status 
    END,
    updated_at = now()
  WHERE status NOT IN ('archived', 'inactive')
  AND (
    status = 'needs_cleanup' 
    OR (type = 'water' AND water_level = 'empty')
  )
  AND last_activity_at < (now() - interval '12 hours');

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
