import { openDB, type IDBPDatabase } from 'idb';
import type { Station, AnimalReport, StationUpdate } from './types';

const DB_NAME = 'pawloop-offline';
const DB_VERSION = 1;

// ─── Mutation Queue Types ────────────────────────────────

export interface PendingMutation {
  id: string;
  table: 'stations' | 'reports' | 'updates';
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

// ─── Initialize DB ───────────────────────────────────────

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Cached data stores
      if (!db.objectStoreNames.contains('stations')) {
        db.createObjectStore('stations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('updates')) {
        db.createObjectStore('updates', { keyPath: 'id' });
      }
      // Offline mutation queue
      if (!db.objectStoreNames.contains('pendingMutations')) {
        const store = db.createObjectStore('pendingMutations', { keyPath: 'id' });
        store.createIndex('by-created', 'createdAt');
      }
    },
  });
}

// ─── Cache Operations ────────────────────────────────────

export async function cacheStations(stations: Station[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('stations', 'readwrite');
  await Promise.all([
    ...stations.map((s) => tx.store.put(s)),
    tx.done,
  ]);
}

export async function getCachedStations(): Promise<Station[]> {
  const db = await getDB();
  return db.getAll('stations') as Promise<Station[]>;
}

export async function cacheReports(reports: AnimalReport[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('reports', 'readwrite');
  await Promise.all([
    ...reports.map((r) => tx.store.put(r)),
    tx.done,
  ]);
}

export async function getCachedReports(): Promise<AnimalReport[]> {
  const db = await getDB();
  return db.getAll('reports') as Promise<AnimalReport[]>;
}

export async function cacheUpdates(updates: StationUpdate[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('updates', 'readwrite');
  await Promise.all([
    ...updates.map((u) => tx.store.put(u)),
    tx.done,
  ]);
}

export async function getCachedUpdates(): Promise<StationUpdate[]> {
  const db = await getDB();
  return db.getAll('updates') as Promise<StationUpdate[]>;
}

// ─── Mutation Queue ──────────────────────────────────────

export async function queueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retries'>): Promise<string> {
  const db = await getDB();
  const id = `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: PendingMutation = {
    ...mutation,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await db.put('pendingMutations', entry);
  return id;
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDB();
  return db.getAll('pendingMutations') as Promise<PendingMutation[]>;
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingMutations', id);
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB();
  const mutation = await db.get('pendingMutations', id) as PendingMutation | undefined;
  if (mutation) {
    mutation.retries += 1;
    await db.put('pendingMutations', mutation);
  }
}

export async function clearAllPendingMutations(): Promise<void> {
  const db = await getDB();
  await db.clear('pendingMutations');
}

// ─── Sync Status ─────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pendingMutations');
}
