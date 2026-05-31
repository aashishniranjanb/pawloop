import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';
import { Insight, RiskZone, generateInsights, getEcosystemRiskZones } from '@/lib/intelligence';
import { useDemoEngine } from '@/lib/demo-engine';

export function useIntelligence(demoMode: boolean = false) {
  const demo = useDemoEngine(demoMode);

  // We provide a fallback to client-side logic for demo mode
  const { data: insights = [] } = useQuery({
    queryKey: ['insights', demoMode, demo.timeContext.period],
    queryFn: async () => {
      if (demoMode) {
        return generateInsights(demo.stations, demo.reports, demo.updates);
      }
      const { data, error } = await supabase.rpc('get_ecosystem_narrative', { environment_state: demo.timeContext.period });
      if (error) {
        console.warn('Failed to fetch narrative from backend, falling back...', error);
        return [{
          id: 'system-fallback',
          type: 'system',
          icon: '⚙️',
          title: 'Intelligence Engine Offline',
          body: 'Strategic Intelligence layer requires database migration 006 to be applied.',
          priority: 100
        }] as Insight[];
      }
      return (data || []) as Insight[];
    },
    refetchInterval: 60000, // fetch every minute
  });

  const { data: riskZones = [] } = useQuery({
    queryKey: ['risk-zones', demoMode],
    queryFn: async () => {
      if (demoMode) {
        return getEcosystemRiskZones(demo.stations);
      }
      const { data, error } = await supabase.rpc('get_risk_zones');
      if (error) {
        console.warn('Failed to fetch risk zones from backend, falling back...', error);
        return [];
      }
      return (data || []) as RiskZone[];
    },
    refetchInterval: 120000, // every 2 minutes
  });

  return { insights, riskZones };
}
