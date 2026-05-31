-- PawLoop Phase 2 — Database Migration
-- Run this in Supabase SQL Editor AFTER schema.sql + seed.sql

-- ═══════════════════════════════════════════════════════
-- MODIFY STATIONS — Add lifecycle + priority fields
-- ═══════════════════════════════════════════════════════

-- Expand status enum to include 'archived' and 'degrading' and 'critical'
ALTER TABLE public.stations
  DROP CONSTRAINT IF EXISTS stations_status_check;

ALTER TABLE public.stations
  ADD CONSTRAINT stations_status_check
  CHECK (status IN ('active', 'needs_refill', 'needs_cleanup', 'inactive', 'archived', 'degrading', 'critical'));

-- Add operational fields
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════
-- MODIFY REPORTS — Add volunteer assignment
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- ═══════════════════════════════════════════════════════
-- TASKS (Volunteer task assignments)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('refill_water', 'cleanup', 'rescue', 'inspection', 'feeding')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'in_progress', 'completed', 'expired')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  priority INTEGER DEFAULT 0,
  notes TEXT,
  eta_minutes INTEGER,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- NOTIFICATIONS (In-app notification store)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('operational', 'urgency', 'volunteer', 'community', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- ANALYTICS EVENTS (Operational metrics tracking)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- MODIFY UPDATES — Add task reference
-- ═══════════════════════════════════════════════════════

-- Expand action enum
ALTER TABLE public.updates
  DROP CONSTRAINT IF EXISTS updates_action_check;

ALTER TABLE public.updates
  ADD CONSTRAINT updates_action_check
  CHECK (action IN ('refilled', 'cleaned', 'reported_issue', 'status_change', 'created', 'archived', 'claimed', 'completed_task'));

ALTER TABLE public.updates
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — New tables
-- ═══════════════════════════════════════════════════════

-- Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by everyone"
  ON public.tasks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Task assignees and creators can update"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Analytics Events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics viewable by everyone"
  ON public.analytics_events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can log events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════
-- UPDATE STATION POLICIES — Allow archiving
-- ═══════════════════════════════════════════════════════

-- Drop and recreate station update policy to include admin access
DROP POLICY IF EXISTS "Station creators and volunteers can update" ON public.stations;

CREATE POLICY "Station creators volunteers and admins can update"
  ON public.stations FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = volunteer_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow report updates by assignees too
DROP POLICY IF EXISTS "Report creators can update" ON public.reports;

CREATE POLICY "Report creators and assignees can update"
  ON public.reports FOR UPDATE
  USING (auth.uid() = reported_by OR auth.uid() = assigned_to);

-- ═══════════════════════════════════════════════════════
-- REALTIME — Enable for new tables
-- ═══════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tasks_station ON public.tasks (station_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stations_priority ON public.stations (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_stations_last_activity ON public.stations (last_activity_at);

-- ═══════════════════════════════════════════════════════
-- AUTO-UPDATE last_activity_at on station updates
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_station_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stations
    SET last_activity_at = now()
    WHERE id = NEW.station_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_update_refresh_activity ON public.updates;
CREATE TRIGGER on_update_refresh_activity
  AFTER INSERT ON public.updates
  FOR EACH ROW EXECUTE FUNCTION public.update_station_last_activity();
