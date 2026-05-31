'use client';

import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import type { SyncStatus } from '@/lib/use-offline-sync';

interface SyncIndicatorProps {
  status: SyncStatus;
  pendingCount: number;
  onRetry?: () => void;
}

export default function SyncIndicator({ status, pendingCount, onRetry }: SyncIndicatorProps) {
  if (status === 'synced') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center">
      <div
        className={`
          pointer-events-auto mt-2 px-4 py-2 rounded-full flex items-center gap-2
          text-xs font-semibold shadow-float animate-slide-down
          ${status === 'offline' ? 'bg-gray-800 text-white' : ''}
          ${status === 'pending' ? 'bg-amber-500 text-white' : ''}
          ${status === 'syncing' ? 'bg-brand-sky text-white' : ''}
          ${status === 'error' ? 'bg-red-500 text-white' : ''}
        `}
      >
        {status === 'offline' && (
          <>
            <WifiOff size={14} />
            <span>You&apos;re offline — changes will sync later</span>
          </>
        )}

        {status === 'pending' && (
          <>
            <AlertCircle size={14} />
            <span>{pendingCount} action{pendingCount !== 1 ? 's' : ''} waiting to sync</span>
            {onRetry && (
              <button onClick={onRetry} className="ml-1 underline opacity-80 hover:opacity-100">
                Sync now
              </button>
            )}
          </>
        )}

        {status === 'syncing' && (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>Syncing {pendingCount} action{pendingCount !== 1 ? 's' : ''}…</span>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={14} />
            <span>Sync failed</span>
            {onRetry && (
              <button onClick={onRetry} className="ml-1 underline opacity-80 hover:opacity-100">
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
