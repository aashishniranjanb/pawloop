import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';
import type { Station } from '@/lib/types';
import { useDemoContext } from '@/lib/demo-context';
import { useOfflineSync } from '@/lib/use-offline-sync';


export function useStations(demoMode: boolean = false) {
  const { demoEngine: demo } = useDemoContext();
  const offlineSync = useOfflineSync();
  const queryClient = useQueryClient();

  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ['stations', demoMode],
    queryFn: async () => {
      if (demoMode) return demo.stations;

      if (!navigator.onLine) {
        const cached = await offlineSync.loadCachedData();
        return cached.stations;
      }

      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const dbStations = data as Station[];
      offlineSync.cacheData(dbStations, [], []); // cache real db stations
      return dbStations;
    },
    staleTime: 60000,
  });

  const updateStation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Station> }) => {
      if (demoMode) {
        demo.updateStationDemo(id, data);
        return { error: null };
      }

      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...data, updated_by: user?.id || null, updated_at: new Date().toISOString() };

      if (!navigator.onLine) {
        await offlineSync.addMutation('stations', 'update', { id, ...payload });
        return { error: null };
      }

      const { error } = await supabase.from('stations').update(payload).eq('id', id);
      if (error) throw error;
      return { error: null };
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['stations', demoMode] });
      const previousStations = queryClient.getQueryData<Station[]>(['stations', demoMode]);
      if (previousStations) {
        queryClient.setQueryData<Station[]>(['stations', demoMode], (old) =>
          old?.map((s) => (s.id === id ? { ...s, ...data } : s))
        );
      }
      return { previousStations };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousStations) {
        queryClient.setQueryData(['stations', demoMode], context.previousStations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stations', demoMode] });
    },
  });

  return {
    stations,
    loading: isLoading,
    error,
    updateStation: async (id: string, data: Partial<Station>) => await updateStation.mutateAsync({ id, data }),
  };
}
