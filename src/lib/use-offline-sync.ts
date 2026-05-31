'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import {
  getPendingMutations,
  removeMutation,
  incrementRetry,
  queueMutation,
  cacheStations,
  cacheReports,
  cacheUpdates,
  getCachedStations,
  getCachedReports,
  getCachedUpdates,
  getPendingCount,
  type PendingMutation,
} from './offline-store';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline' | 'error';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced');
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process pending mutations
  const processMutations = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const mutations = await getPendingMutations();
      if (mutations.length === 0) {
        setSyncStatus('synced');
        setPendingCount(0);
        syncingRef.current = false;
        return;
      }

      // Sort chronologically to guarantee referential integrity (e.g. stations insert before updates refer to it)
      mutations.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setSyncStatus('syncing');

      for (const mutation of mutations) {
        try {
          await executeMutation(mutation);
          await removeMutation(mutation.id);
        } catch (err) {
          console.warn('Sync failed for mutation:', mutation.id, err);
          if (mutation.retries >= 3) {
            await removeMutation(mutation.id); // Give up after 3 retries
          } else {
            await incrementRetry(mutation.id);
          }
        }
      }

      const remaining = await getPendingCount();
      setPendingCount(remaining);
      setSyncStatus(remaining > 0 ? 'pending' : 'synced');
    } catch (err) {
      console.error('Sync process error:', err);
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      setTimeout(() => {
        processMutations();
      }, 0);
    }
  }, [isOnline, processMutations]);

  // Periodic sync check
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
      if (count > 0 && navigator.onLine) {
        processMutations();
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [processMutations]);

  // Queue a mutation for later sync
  const addMutation = useCallback(
    async (
      table: PendingMutation['table'],
      operation: PendingMutation['operation'],
      data: Record<string, unknown>
    ) => {
      await queueMutation({ table, operation, data });
      const count = await getPendingCount();
      setPendingCount(count);
      setSyncStatus('pending');

      // Try to sync immediately if online
      if (navigator.onLine) {
        setTimeout(processMutations, 500);
      }
    },
    [processMutations]
  );

  // Cache data for offline use
  const cacheData = useCallback(
    async (
      stations: Parameters<typeof cacheStations>[0],
      reports: Parameters<typeof cacheReports>[0],
      updates: Parameters<typeof cacheUpdates>[0]
    ) => {
      try {
        await Promise.all([
          cacheStations(stations),
          cacheReports(reports),
          cacheUpdates(updates),
        ]);
      } catch (err) {
        console.warn('Cache write failed:', err);
      }
    },
    []
  );

  // Load cached data (for offline fallback)
  const loadCachedData = useCallback(async () => {
    try {
      const [stations, reports, updates] = await Promise.all([
        getCachedStations(),
        getCachedReports(),
        getCachedUpdates(),
      ]);
      return { stations, reports, updates };
    } catch {
      return { stations: [], reports: [], updates: [] };
    }
  }, []);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    addMutation,
    cacheData,
    loadCachedData,
    retrySync: processMutations,
  };
}

// ─── Execute a single mutation against Supabase ─────────

async function executeMutation(mutation: PendingMutation): Promise<void> {
  const { table, operation, data } = mutation;

  if (operation === 'insert') {
    const { error } = await supabase.from(table).insert(data);
    if (error) throw error;
  } else if (operation === 'update') {
    const { id, ...rest } = data;
    
    // Field-Level Conflict Resolution Strategy
    // `rest` contains only the partial fields modified by the user. 
    // Supabase `.update()` inherently performs field-level merging.
    const { data: currentData } = await supabase.from(table).select('*').eq('id', id as string).single();
    
    if (currentData) {
      const currentUpdated = new Date(currentData.updated_at || 0).getTime();
      const newUpdated = new Date((rest.updated_at as string) || Date.now()).getTime();
      
      // Merge notes non-destructively
      if (rest.notes && currentData.notes && rest.notes !== currentData.notes) {
        if (!String(currentData.notes).includes(String(rest.notes))) {
          rest.notes = `${currentData.notes} | [Offline Sync]: ${rest.notes}`;
        }
      }
      
      // If the server data is newer than when the offline mutation was created,
      // we selectively drop fields from the patch to prevent reverting progress.
      if (newUpdated < currentUpdated) {
        // Prevent offline client from reverting an active/clean station back to dirty
        if (currentData.status === 'active' || currentData.status === 'resolved') {
          delete rest.status;
        }
        // Protect water and cleanliness if server already shows them full/clean
        if (currentData.water_level === 'full' || currentData.water_level === 'half') {
          delete rest.water_level;
        }
        if (currentData.cleanliness >= 4) {
          delete rest.cleanliness;
        }
      }
    }

    // Apply the filtered, field-level patch
    const { error } = await supabase.from(table).update(rest).eq('id', id as string);
    if (error) throw error;
  } else if (operation === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', data.id as string);
    if (error) throw error;
  }
}
