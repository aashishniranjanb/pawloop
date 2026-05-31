import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';
import type { AnimalReport, StationUpdate, Task } from '@/lib/types';
import { useDemoContext } from '@/lib/demo-context';
import { useOfflineSync } from '@/lib/use-offline-sync';


export function useReports(demoMode: boolean = false) {
  const { demoEngine: demo } = useDemoContext();
  const offlineSync = useOfflineSync();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['reports', demoMode],
    queryFn: async () => {
      if (demoMode) return demo.reports;

      if (!navigator.onLine) {
        const cached = await offlineSync.loadCachedData();
        return cached.reports;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbReports = data as AnimalReport[];
      offlineSync.cacheData([], dbReports, []); // cache real db reports
      return dbReports;
    },
    staleTime: 60000,
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (demoMode) {
        demo.resolveReportDemo(id, notes || '');
        return { error: null };
      }

      const { data: { user } } = await supabase.auth.getUser();
      const updateData = {
        status: 'resolved' as const,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || null,
        updated_by: user?.id || null,
      };

      if (!navigator.onLine) {
        await offlineSync.addMutation('reports', 'update', { id, ...updateData });
        return { error: null };
      }

      const { error } = await supabase.from('reports').update(updateData).eq('id', id);
      if (error) throw error;
      return { error: null };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const claimReport = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      if (demoMode) {
        // Just mock the claim in demo by doing nothing or we can add a claimReportDemo
        return { error: null };
      }

      const { data: { user } } = await supabase.auth.getUser();
      const updateData = {
        assigned_to: userId,
        status: 'in_progress' as const,
        updated_by: user?.id || null,
      };

      if (!navigator.onLine) {
        await offlineSync.addMutation('reports', 'update', { id, ...updateData });
        return { error: null };
      }

      const { error } = await supabase.from('reports').update(updateData).eq('id', id);
      if (error) throw error;
      return { error: null };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  return {
    reports,
    loading: isLoading,
    error,
    resolveReport: async (id: string, notes?: string) => await resolveReport.mutateAsync({ id, notes }),
    claimReport: async (id: string, userId: string) => await claimReport.mutateAsync({ id, userId }),
  };
}

export function useUpdates(demoMode: boolean = false) {
  const { demoEngine: demo } = useDemoContext();
  const offlineSync = useOfflineSync();
  const queryClient = useQueryClient();

  const { data: updates = [], isLoading, error } = useQuery({
    queryKey: ['updates', demoMode],
    queryFn: async () => {
      if (demoMode) return demo.updates;

      if (!navigator.onLine) {
        const cached = await offlineSync.loadCachedData();
        return cached.updates;
      }

      const { data, error } = await supabase
        .from('updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const dbUpdates = data as StationUpdate[];
      offlineSync.cacheData([], [], dbUpdates); // cache real db updates
      return dbUpdates;
    },
    staleTime: 60000,
  });

  const createUpdate = useMutation({
    mutationFn: async (data: Partial<StationUpdate>) => {
      if (demoMode) {
        demo.createUpdateDemo(data);
        return { error: null };
      }
      if (!navigator.onLine) {
        await offlineSync.addMutation('updates', 'insert', data as Record<string, unknown>);
        return { error: null };
      }
      const { error } = await supabase.from('updates').insert([data]);
      if (error) throw error;
      return { error: null };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['updates', demoMode] });
    },
  });

  return {
    updates,
    loading: isLoading,
    error,
    createUpdate: async (data: Partial<StationUpdate>) => await createUpdate.mutateAsync(data),
  };
}

export function useTasks(demoMode: boolean = false) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', demoMode],
    queryFn: async () => {
      if (demoMode) return [];
      if (!navigator.onLine) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
    staleTime: 60000,
  });

  const claimTask = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string, userId: string }) => {
      if (demoMode) return { error: null };
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('tasks')
        .update({
          assigned_to: userId,
          status: 'claimed',
          updated_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
      return { error: null };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', demoMode] });
    },
  });

  return {
    tasks,
    loading: isLoading,
    error,
    claimTask: async (taskId: string, userId: string) => await claimTask.mutateAsync({ taskId, userId }),
  };
}

export function useEcosystemDegradation(demoMode: boolean = false) {
  const queryClient = useQueryClient();

  const applyDegradation = useMutation({
    mutationFn: async () => {
      if (demoMode) {
        return { error: null, affectedCount: 0 };
      }
      const { data, error } = await supabase.rpc('apply_ecosystem_degradation');
      if (error) throw error;
      return { error: null, affectedCount: data as number };
    },
    onSuccess: (res) => {
      if (res.affectedCount && res.affectedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['stations', demoMode] });
        queryClient.invalidateQueries({ queryKey: ['updates', demoMode] });
      }
    },
  });

  return {
    applyDegradation: async () => await applyDegradation.mutateAsync(),
    loading: applyDegradation.isPending,
    error: applyDegradation.error,
  };
}

