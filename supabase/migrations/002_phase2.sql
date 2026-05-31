-- Phase 2 schema: Reports, Updates, and Tasks

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id text REFERENCES public.stations(id),
  user_id uuid REFERENCES public.profiles(id),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  notes text,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at timestamp with time zone,
  resolution_notes text
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports are viewable by everyone."
  ON public.reports FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reports."
  ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reports."
  ON public.reports FOR UPDATE USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id text REFERENCES public.stations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Updates are viewable by everyone."
  ON public.updates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert updates."
  ON public.updates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id text REFERENCES public.stations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  assigned_to uuid REFERENCES public.profiles(id),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  urgency integer DEFAULT 50,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by everyone."
  ON public.tasks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tasks."
  ON public.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tasks."
  ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE reports;
ALTER PUBLICATION supabase_realtime ADD TABLE updates;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
