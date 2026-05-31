'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStations } from '@/hooks/use-stations';
import { useReports, useUpdates, useTasks } from '@/hooks/use-ecosystem';
import { useAnalyticsEvents } from '@/hooks/use-analytics-events';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useDemoContext } from '@/lib/demo-context';
import { useOfflineSync } from '@/lib/use-offline-sync';
import { supabase } from '@/utils/supabase/client';

export function useRealtime(demoMode: boolean = false) {
  const queryClient = useQueryClient();

  // 1. Initialize Realtime Channels & Cache Invalidation
  useRealtimeSync(demoMode);

  // 1.5. Trigger natural degradation simulation on backend in Live Mode
  useEffect(() => {
    if (demoMode) return;

    const runDegradation = async () => {
      try {
        const { data, error } = await supabase.rpc('apply_ecosystem_degradation');
        if (error) {
          console.warn('Ecosystem degradation simulated or skipped:', error.message);
        } else if (data && data > 0) {
          console.log(`[Ecosystem Intelligence] Natural degradation simulated: ${data} station(s) updated.`);
          queryClient.invalidateQueries({ queryKey: ['stations', demoMode] });
          queryClient.invalidateQueries({ queryKey: ['updates', demoMode] });
        }
      } catch (err) {
        console.warn('Degradation trigger telemetry warning:', err);
      }
    };

    const timer = setTimeout(runDegradation, 2000);
    return () => clearTimeout(timer);
  }, [demoMode, queryClient]);


  // 2. Fetch Modular React Query Hooks
  const { stations, loading: loadingStations, updateStation } = useStations(demoMode);
  const { reports, loading: loadingReports, resolveReport, claimReport } = useReports(demoMode);
  const { updates, loading: loadingUpdates, createUpdate } = useUpdates(demoMode);
  const { tasks, claimTask } = useTasks(demoMode);
  const { analyticsEvents, trackEvent } = useAnalyticsEvents(demoMode);

  // 3. Demo Engine state
  const { demoEngine: demo } = useDemoContext();

  // 4. Offline Sync
  const offlineSync = useOfflineSync();

  const loading = loadingStations || loadingReports || loadingUpdates;

  // We expose standard CRUD wrappers to not break existing components
  const archiveStation = async (id: string) => {
    return await updateStation(id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    });
  };

  const updateVolunteerState = async (state: 'available' | 'on_mission' | 'offline' | 'resting') => {
    if (demoMode) return { error: null };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: new Error('User not logged in') };
      
      const { error } = await supabase
        .from('profiles')
        .update({ volunteer_state: state })
        .eq('id', user.id);
      return { error };
    } catch (err: unknown) {
      console.warn('Failed to update volunteer state:', err);
      return { error: err };
    }
  };

  return {
    stations,
    reports,
    updates,
    tasks,
    analyticsEvents,
    loading,
    error: null,
    
    // CRUD Operations mapping
    updateStation,
    archiveStation,
    resolveReport,
    claimReport,
    createUpdate,
    claimTask,
    updateVolunteerState,
    trackEvent,

    // Demo State
    demoMode,
    demoStats: demo.demoStats,
    activeMission: demo.activeMission,
    timeContext: demo.timeContext,
    environmentState: demo.environmentState,
    cityPulse: demo.cityPulse,
    triggerScenario: demo.triggerScenario,

    // Offline Engine
    offlineSync,
  };
}

export const SubscriptionRegistry: Record<string, { status: string; eventCount: number }> = {};
