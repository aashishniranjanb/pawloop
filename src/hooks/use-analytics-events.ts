import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';

export function useAnalyticsEvents(demoMode: boolean = false) {
  const { data: analyticsEvents = [], isLoading, error } = useQuery({
    queryKey: ['analyticsEvents', demoMode],
    queryFn: async () => {
      if (demoMode) return [];
      if (!navigator.onLine) return [];

      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Record<string, unknown>[];
    },
    staleTime: 60000,
  });

  const trackEvent = async (eventType: string, metadata: Record<string, unknown> = {}) => {
    if (demoMode) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        event_type: eventType,
        metadata,
        user_id: user?.id || null,
        created_at: new Date().toISOString(),
      };
      
      if (!navigator.onLine) {
        // We could use offlineSync here if we want to sync analytics, 
        // but typically analytics can be dropped if offline to save queue space.
        // For now, we'll just ignore offline analytics or we could add it to offlineSync.
        return;
      }
      
      await supabase.from('analytics_events').insert([payload]);
    } catch (e) {
      console.warn('Failed to track analytics event:', e);
    }
  };

  return { analyticsEvents, loading: isLoading, error, trackEvent };
}
