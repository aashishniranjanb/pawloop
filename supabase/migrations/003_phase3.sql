-- Phase 3 schema updates

-- Add community_group field to stations to track local ownership models (e.g., 'Velachery Lake Care Network')
ALTER TABLE public.stations 
ADD COLUMN IF NOT EXISTS community_group text;

-- Add archived_at field to stations to support the new archiving feature
ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Add health_score to stations (needed for map prioritization, ecosystem health, command center)
ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 100;

-- Add priority_score to stations (needed for mission generation, urgency ordering, orchestration)
ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 50;

-- Add last_activity_at to stations (needed for confidence scoring, anti-entropy, stale detection)
ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  action_url text,
  station_id text REFERENCES public.stations(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist before creating them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their own notifications.'
  ) THEN
    CREATE POLICY "Users can view their own notifications."
      ON public.notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their own notifications.'
  ) THEN
    CREATE POLICY "Users can update their own notifications."
      ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Authenticated users can insert notifications.'
  ) THEN
    CREATE POLICY "Authenticated users can insert notifications."
      ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  station_id text REFERENCES public.stations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'analytics_events' AND policyname = 'Analytics events are viewable by authenticated users.'
  ) THEN
    CREATE POLICY "Analytics events are viewable by authenticated users."
      ON public.analytics_events FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'analytics_events' AND policyname = 'Authenticated users can insert analytics events.'
  ) THEN
    CREATE POLICY "Authenticated users can insert analytics events."
      ON public.analytics_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_events;

-- Add updated_by columns for auditability, moderation, and volunteer accountability
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add volunteer_state column to profiles (Available, On Mission, Offline, Resting)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS volunteer_state text DEFAULT 'offline';

