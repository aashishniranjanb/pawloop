'use client';

import { ArrowLeft, RefreshCw, Droplets, Utensils, AlertCircle, Plus, Sparkles, UserCheck, Archive, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { STATION_TYPE_LABELS, UpdateAction, type AnimalType } from '@/lib/types';
import { ANIMAL_ICONS } from '@/lib/icons';
import { PawPrint } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import BottomNav from '@/components/layout/bottom-nav';
import { useRealtime } from '@/lib/use-realtime';
import { useDemoContext } from '@/lib/demo-context';
import { type LucideIcon } from 'lucide-react';

const ACTION_CONFIG: Record<UpdateAction, { icon: LucideIcon; color: string; bg: string }> = {
  refilled: { icon: Utensils, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/20' },
  cleaned: { icon: Sparkles, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/20' },
  reported_issue: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/40' },
  status_change: { icon: RefreshCw, color: 'text-amber-400', bg: 'bg-amber-950/40' },
  created: { icon: Plus, color: 'text-purple-400', bg: 'bg-purple-900/40' },
  archived: { icon: Archive, color: 'text-gray-400', bg: 'bg-gray-800/60' },
  claimed: { icon: UserCheck, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/20' },
  completed_task: { icon: CheckCircle2, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/20' },
};

export default function ActivityPage() {
  const router = useRouter();
  const { demoMode } = useDemoContext();
  const { updates, stations, loading } = useRealtime(demoMode);

  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)] overflow-hidden">
      {/* Header */}
      <header className="px-4 pt-10 pb-4 bg-[var(--bg-main)] z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[var(--border-light)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <ArrowLeft size={20} className="text-[var(--text-body)]" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold text-[var(--text-heading)] leading-tight">
              City Activity
            </h1>
            <p className="text-xs text-[var(--text-body)] font-medium">Live community updates</p>
          </div>
        </div>
      </header>

      {/* Feed */}
      <div className="scroll-area flex-1 px-5 pt-4 pb-[120px] relative">
        {loading && sortedUpdates.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-brand-forest border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-0 relative">
            {/* Timeline Line */}
            <div className="absolute left-[19px] top-6 bottom-10 w-px bg-[var(--border-light)]" />
            
            {sortedUpdates.map((update, index) => {
              const config = ACTION_CONFIG[update.action];
              const station = stations.find((s) => s.id === update.station_id);
              const Icon = config.icon;

              return (
                <div
                  key={update.id}
                  className="flex items-start gap-4 py-3 relative animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                >
                  {/* Icon Node */}
                  <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 relative z-10 border-4 border-[var(--bg-main)]`}>
                    <Icon size={16} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-2 pb-4">
                    <p className="text-sm text-[var(--text-body)] leading-snug">
                      <span className="font-semibold text-[var(--text-heading)] capitalize">
                        {update.action.replace('_', ' ')}
                      </span>
                      {station && (() => {
                        const AnimalIcon = ANIMAL_ICONS[station.animal_type as AnimalType] || PawPrint;
                        return (
                          <span className="text-[var(--text-body)] inline-flex items-center gap-1 ml-1">
                            at {STATION_TYPE_LABELS[station.type].toLowerCase()} <AnimalIcon size={14} className="opacity-80" />
                          </span>
                        );
                      })()}
                    </p>
                    
                    {update.notes && (
                      <p className="text-sm text-[var(--text-body)] mt-1">
                        &quot;{update.notes}&quot;
                      </p>
                    )}
                    
                    <span className="text-xs text-[var(--text-body)] font-medium block mt-1.5">
                      {timeAgo(update.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && sortedUpdates.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-white border border-[var(--border-light)] rounded-full flex items-center justify-center shadow-sm mb-4">
              <Droplets size={24} className="text-[var(--text-body)]" />
            </div>
            <p className="font-heading font-semibold text-[var(--text-heading)]">No activity yet</p>
            <p className="text-sm text-[var(--text-body)] mt-1 max-w-[200px]">Check back later to see community updates.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
