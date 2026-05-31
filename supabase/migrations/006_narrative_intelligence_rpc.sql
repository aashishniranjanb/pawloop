-- Sprint 3: Narrative Intelligence RPCs

-- 1. Ecosystem Narrative Generator
CREATE OR REPLACE FUNCTION public.get_ecosystem_narrative(environment_state text)
RETURNS json AS $$
DECLARE
  v_insights jsonb := '[]'::jsonb;
  v_stale_count int;
  v_critical_count int;
  v_injured_count int;
  v_water_demand int;
  v_total_water int;
  v_recent_updates int;
  v_avg_health numeric;
  v_total_active int;
  v_is_peak_water boolean;
BEGIN
  -- 1. Stale stations (no activity > 48h)
  SELECT COUNT(*) INTO v_stale_count FROM public.stations 
  WHERE status NOT IN ('archived', 'inactive') 
  AND (last_activity_at IS NULL OR last_activity_at < (now() - interval '48 hours'));
  
  IF v_stale_count > 0 THEN
    v_insights := v_insights || jsonb_build_object(
      'id', 'stale-warning', 'type', 'warning', 'icon', '⏰',
      'title', v_stale_count || ' station(s) going stale',
      'body', 'No volunteer activity in 48+ hours. These need attention.',
      'priority', 65
    );
  END IF;

  -- 2. Critical stations
  SELECT COUNT(*) INTO v_critical_count FROM public.stations 
  WHERE status IN ('needs_cleanup', 'critical');
  
  IF v_critical_count > 0 THEN
    v_insights := v_insights || jsonb_build_object(
      'id', 'critical-stations', 'type', 'urgent', 'icon', '🚨',
      'title', v_critical_count || ' critical station(s)',
      'body', 'Immediate cleanup or refill required to maintain ecosystem health.',
      'priority', 90
    );
  END IF;

  -- 3. Injured animals
  SELECT COUNT(*) INTO v_injured_count FROM public.reports 
  WHERE status = 'open' AND condition IN ('injured', 'sick');
  
  IF v_injured_count > 0 THEN
    v_insights := v_insights || jsonb_build_object(
      'id', 'injured-animals', 'type', 'urgent', 'icon', '🩹',
      'title', v_injured_count || ' injured/sick animal report(s)',
      'body', 'Animals in distress reported nearby. Volunteer response needed.',
      'priority', 95
    );
  END IF;

  -- 4. Water demand
  SELECT COUNT(*) INTO v_water_demand FROM public.stations 
  WHERE type = 'water' AND water_level IN ('empty', 'half') AND status NOT IN ('archived', 'inactive');
  
  SELECT COUNT(*) INTO v_total_water FROM public.stations 
  WHERE type = 'water' AND status NOT IN ('archived', 'inactive');
  
  IF v_total_water > 0 AND v_water_demand > (v_total_water * 0.3) THEN
    v_insights := v_insights || jsonb_build_object(
      'id', 'water-demand', 'type', 'warning', 'icon', '💧',
      'title', 'Water refill demand rising',
      'body', v_water_demand || ' of ' || v_total_water || ' water stations need refill.',
      'priority', 60
    );
  END IF;

  -- 5. Active community
  SELECT COUNT(*) INTO v_recent_updates FROM public.updates 
  WHERE created_at > (now() - interval '2 hours');
  
  IF v_recent_updates >= 3 THEN
    v_insights := v_insights || jsonb_build_object(
      'id', 'active-community', 'type', 'positive', 'icon', '💚',
      'title', 'Community is active',
      'body', v_recent_updates || ' updates in the last 2 hours. Network health improving.',
      'priority', 15
    );
  END IF;

  -- 6. Network health
  SELECT COUNT(*), COALESCE(AVG(health_score), 0) INTO v_total_active, v_avg_health 
  FROM public.stations WHERE status NOT IN ('archived', 'inactive');
  
  v_insights := v_insights || jsonb_build_object(
    'id', 'network-health',
    'type', CASE WHEN v_avg_health > 60 THEN 'positive' WHEN v_avg_health > 35 THEN 'info' ELSE 'warning' END,
    'icon', CASE WHEN v_avg_health > 60 THEN '🟢' WHEN v_avg_health > 35 THEN '🟡' ELSE '🔴' END,
    'title', 'Network health: ' || ROUND(v_avg_health) || '%',
    'body', v_total_active || ' active stations across the city. ' || CASE WHEN v_avg_health > 60 THEN 'Ecosystem is stable.' ELSE 'Some areas need attention.' END,
    'priority', 30
  );

  -- 7. Predictive
  v_is_peak_water := environment_state IN ('afternoon', 'evening', 'heat');
  v_insights := v_insights || jsonb_build_object(
    'id', 'predictive-water-demand',
    'type', CASE WHEN v_is_peak_water THEN 'warning' ELSE 'info' END,
    'icon', '💧',
    'title', 'Water Refill Demand Forecast',
    'body', CASE WHEN v_is_peak_water THEN 'Ecosystem Intelligence: Peak water station refill demand expected due to environment cycle.' ELSE 'Ecosystem Intelligence: Base water station evaporation rate stable.' END,
    'priority', CASE WHEN v_is_peak_water THEN 78 ELSE 35 END
  );

  RETURN (
    SELECT COALESCE(json_agg(i), '[]'::json) FROM (
      SELECT * FROM jsonb_array_elements(v_insights) as i
      ORDER BY (i->>'priority')::int DESC
    ) sub
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Risk Zones Generator
CREATE OR REPLACE FUNCTION public.get_risk_zones()
RETURNS json AS $$
DECLARE
  v_zones jsonb := '[]'::jsonb;
  v_omr_stale int;
  v_vela_empty int;
  v_besant_dirty int;
BEGIN
  -- 1. OMR (Neglect/Low Coverage Risk)
  SELECT COUNT(*) INTO v_omr_stale FROM public.stations 
  WHERE lat BETWEEN 12.95 AND 12.98 AND lng BETWEEN 80.23 AND 80.26
  AND (last_activity_at IS NULL OR last_activity_at < (now() - interval '24 hours'));
  
  IF v_omr_stale > 0 THEN
    v_zones := v_zones || jsonb_build_object(
      'id', 'risk-omr', 'name', 'OMR Tech Corridor Stretch', 'lat', 12.9650, 'lng', 80.2450,
      'radius', 1200, 'riskLevel', 'high', 'type', 'neglect',
      'description', 'Ecosystem Risk: Low volunteer coverage and sparse patrol frequency detected.'
    );
  END IF;

  -- 2. Velachery (Evaporation Risk)
  SELECT COUNT(*) INTO v_vela_empty FROM public.stations 
  WHERE type = 'water' AND water_level IN ('empty', 'half')
  AND lat BETWEEN 12.97 AND 12.99 AND lng BETWEEN 80.21 AND 80.23;
  
  IF v_vela_empty > 0 THEN
    v_zones := v_zones || jsonb_build_object(
      'id', 'risk-velachery', 'name', 'Velachery Lake Peripheral Stretch', 'lat', 12.9816, 'lng', 80.2204,
      'radius', 800, 'riskLevel', 'high', 'type', 'evaporation',
      'description', 'Ecosystem Risk: High concentration of stray bird flocks under ambient heat cycle. Water shortage forecast.'
    );
  END IF;

  -- 3. Besant Nagar (Washout Risk)
  SELECT COUNT(*) INTO v_besant_dirty FROM public.stations 
  WHERE cleanliness <= 3
  AND lat BETWEEN 12.99 AND 13.01 AND lng BETWEEN 80.25 AND 80.28;
  
  IF v_besant_dirty > 0 THEN
    v_zones := v_zones || jsonb_build_object(
      'id', 'risk-besant', 'name', 'Besant Nagar Coastal Beach Stretch', 'lat', 13.0005, 'lng', 80.2685,
      'radius', 900, 'riskLevel', 'medium', 'type', 'washout',
      'description', 'Ecosystem Risk: High humidity and maritime salt spray increases bowl cleanliness degradation risk.'
    );
  END IF;

  RETURN v_zones;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
