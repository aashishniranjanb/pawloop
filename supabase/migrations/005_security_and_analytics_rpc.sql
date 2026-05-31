-- Trigger function to automatically stamp user ID for security and audit trail
CREATE OR REPLACE FUNCTION public.set_audit_updated_by()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind triggers to stations, reports, and tasks
CREATE OR REPLACE TRIGGER tr_stations_set_audit_updated_by
BEFORE INSERT OR UPDATE ON public.stations
FOR EACH ROW EXECUTE FUNCTION public.set_audit_updated_by();

CREATE OR REPLACE TRIGGER tr_reports_set_audit_updated_by
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_audit_updated_by();

CREATE OR REPLACE TRIGGER tr_tasks_set_audit_updated_by
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_audit_updated_by();


-- Trigger function to automatically stamp user_id on updates
CREATE OR REPLACE FUNCTION public.set_update_user_id()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_updates_set_user_id
BEFORE INSERT ON public.updates
FOR EACH ROW EXECUTE FUNCTION public.set_update_user_id();


-- RPC to calculate computed network KPIs on the server to prevent browser client lag
CREATE OR REPLACE FUNCTION public.get_network_kpis()
RETURNS json AS $$
DECLARE
  v_health numeric;
  v_actions bigint;
  v_volunteers bigint;
  v_total_reports bigint;
  v_resolved_reports bigint;
  v_resolution_rate numeric;
BEGIN
  -- 1. Calculated average network health (excluding archived/inactive)
  SELECT COALESCE(AVG(health_score), 100) INTO v_health
  FROM public.stations
  WHERE status != 'archived';

  -- 2. Count total updates / refills & cleanups
  SELECT COUNT(id) INTO v_actions
  FROM public.updates;

  -- 3. Count active/resting volunteers
  SELECT COUNT(id) INTO v_volunteers
  FROM public.profiles
  WHERE volunteer_state IN ('available', 'on_mission', 'resting');

  -- 4. Calculate rescue resolution rate
  SELECT COUNT(id) INTO v_total_reports FROM public.reports;
  SELECT COUNT(id) INTO v_resolved_reports FROM public.reports WHERE status = 'resolved';

  IF v_total_reports > 0 THEN
    v_resolution_rate := ROUND((v_resolved_reports::numeric / v_total_reports::numeric) * 100);
  ELSE
    v_resolution_rate := 100;
  END IF;

  RETURN json_build_object(
    'networkHealth', ROUND(v_health),
    'actionsPerformed', v_actions,
    'volunteersOnline', v_volunteers,
    'resolutionRate', v_resolution_rate
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to calculate zone aggregates on the server
CREATE OR REPLACE FUNCTION public.get_zone_metrics()
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(t) INTO v_result
  FROM (
    SELECT 
      CASE 
        WHEN lat BETWEEN 12.97 AND 12.99 AND lng BETWEEN 80.21 AND 80.23 THEN 'Velachery Pilot Spot'
        WHEN lat BETWEEN 12.95 AND 12.97 AND lng BETWEEN 80.23 AND 80.25 THEN 'OMR Tech Corridor'
        WHEN lat BETWEEN 12.99 AND 13.01 AND lng BETWEEN 80.25 AND 80.27 THEN 'Besant Nagar Coastal Network'
        ELSE 'General Area'
      END as name,
      CASE 
        WHEN COUNT(id) FILTER (WHERE status IN ('needs_refill', 'needs_cleanup', 'critical')) > 0 THEN 'critical'
        ELSE 'stable'
      END as status,
      COALESCE(COUNT(DISTINCT updated_by), 0) as active_volunteers
    FROM public.stations
    WHERE status != 'archived'
    GROUP BY name
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
