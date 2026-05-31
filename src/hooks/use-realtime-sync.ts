import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';

export function useRealtimeSync(demoMode: boolean = false) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (demoMode) return;

    const stationsChannel = supabase
      .channel('stations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stations', demoMode] });
        queryClient.invalidateQueries({ queryKey: ['risk-zones'] });
      })
      .subscribe();

    const reportsChannel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reports', demoMode] });
        queryClient.invalidateQueries({ queryKey: ['risk-zones'] });
      })
      .subscribe();

    const updatesChannel = supabase
      .channel('updates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, () => {
        queryClient.invalidateQueries({ queryKey: ['updates', demoMode] });
      })
      .subscribe();

    const tasksChannel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', demoMode] });
      })
      .subscribe();

    const analyticsChannel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['analyticsEvents', demoMode] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stationsChannel);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(updatesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(analyticsChannel);
    };
  }, [demoMode, queryClient]);
}
