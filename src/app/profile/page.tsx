/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, MapPin, AlertTriangle, Activity, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/layout/bottom-nav';
import { supabase } from '@/utils/supabase/client';
import { STATION_TYPE_LABELS, UpdateAction, AnimalType, StationType } from '@/lib/types';
import { Utensils, Sparkles, AlertCircle, RefreshCw, Plus, Archive, UserCheck, CheckCircle2, PawPrint } from 'lucide-react';
import { ANIMAL_ICONS } from '@/lib/icons';
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { demoMode, demoEngine } = useDemoContext();
  const [profileState, setProfileState] = useState<any>(null);
  const [statsState, setStatsState] = useState({ stations: 0, reports: 0, updates: 0 });
  const [userUpdatesState, setUserUpdatesState] = useState<any[]>([]);

  let profile = profileState;
  let stats = statsState;
  let userUpdates = userUpdatesState;

  if (demoMode) {
    profile = {
      name: 'Demo Volunteer',
      role: 'Community Lead',
      avatar_url: null,
    };
    const myStations = demoEngine.stations.filter(s => s.created_by === 'demo-user');
    const myReports = demoEngine.reports.filter(r => r.reported_by === 'demo-user');
    const myUpdates = demoEngine.updates.filter(u => u.user_id === 'demo-user');
    
    stats = {
      stations: myStations.length || 0,
      reports: myReports.length || 0,
      updates: myUpdates.length || 0,
    };
    userUpdates = myUpdates.slice(0, 5);
  }

  useEffect(() => {
    if (demoMode) return;

    if (user) {
      const fetchProfileAndStats = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (!error && data) setProfileState(data);

          const [
            { count: stationsCount },
            { count: reportsCount },
            { count: updatesCount },
            { data: recentUpdates }
          ] = await Promise.all([
            supabase.from('stations').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
            supabase.from('reports').select('*', { count: 'exact', head: true }).eq('reported_by', user.id),
            supabase.from('updates').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('updates')
              .select('*, station:stations(*)')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(5)
          ]);

          setStatsState({
            stations: stationsCount || 0,
            reports: reportsCount || 0,
            updates: updatesCount || 0
          });
          setUserUpdatesState(recentUpdates || []);
        } catch (e) {
          console.error('Error fetching profile stats:', e);
        }
      };
      fetchProfileAndStats();
    } else {
      setTimeout(() => {
        setProfileState(null);
        setStatsState({ stations: 0, reports: 0, updates: 0 });
        setUserUpdatesState([]);
      }, 0);
    }
  }, [user, demoMode, demoEngine]);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)] overflow-hidden">
      <header className="px-4 pt-10 pb-4 bg-[var(--bg-main)] z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[var(--border-light)] hover:bg-[var(--bg-subtle)] transition-colors duration-200"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-[var(--text-body)]" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold text-[var(--text-heading)] leading-tight">
              Profile
            </h1>
          </div>
        </div>
      </header>

      <div className="scroll-area flex-1 px-5 pt-4 pb-[120px] space-y-6">
        {loading && !demoMode ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#3B82F6] border-t-transparent animate-spin" />
          </div>
        ) : (user || demoMode) ? (
          <>
            {/* Minimal User Card */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl p-6 flex flex-col items-center text-center animate-fade-in shadow-sm">
              <div className="w-20 h-20 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center overflow-hidden mb-4 border-4 border-white shadow-md">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-heading font-bold text-[var(--accent-primary)]">
                    {profile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <h2 className="font-heading text-xl font-bold text-[var(--text-heading)] mb-1">
                {profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Demo Volunteer'}
              </h2>
              <p className="text-sm text-[var(--text-body)] mb-3">{user?.email || 'demo@pawloop.network'}</p>
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#22C55E]/20 rounded-full border border-[#22C55E]/30">
                <Shield size={12} className="text-[#22C55E]" />
                <span className="text-xs font-semibold text-[#22C55E] uppercase tracking-wide">
                  {profile?.role || 'Community Member'}
                </span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-[var(--border-light)] shadow-sm rounded-2xl p-4 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '50ms' }}>
                <MapPin size={20} className="text-[#22C55E] mb-2 opacity-80" />
                <div className="text-xl font-heading font-bold text-[var(--text-heading)]">{stats.stations}</div>
                <div className="text-[10px] text-[var(--text-body)] font-medium uppercase tracking-wider mt-1">Stations</div>
              </div>
              <div className="bg-white border border-[var(--border-light)] shadow-sm rounded-2xl p-4 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
                <AlertTriangle size={20} className="text-[#EF4444] mb-2 opacity-80" />
                <div className="text-xl font-heading font-bold text-[var(--text-heading)]">{stats.reports}</div>
                <div className="text-[10px] text-[var(--text-body)] font-medium uppercase tracking-wider mt-1">Reports</div>
              </div>
              <div className="bg-white border border-[var(--border-light)] shadow-sm rounded-2xl p-4 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '150ms' }}>
                <Activity size={20} className="text-[var(--accent-primary)] mb-2 opacity-80" />
                <div className="text-xl font-heading font-bold text-[var(--text-heading)]">{stats.updates}</div>
                <div className="text-[10px] text-[var(--text-body)] font-medium uppercase tracking-wider mt-1">Updates</div>
              </div>
            </div>

            {/* Action List */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl overflow-hidden animate-slide-up divide-y divide-[var(--border-light)] shadow-sm" style={{ animationDelay: '200ms' }}>
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(20);
                  router.push('/analytics');
                }}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center">
                    <Activity size={16} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-[var(--text-heading)] text-sm block">Operational Analytics</span>
                    <span className="text-[9px] text-[var(--text-body)] font-semibold uppercase tracking-wider block">Chennai Pilot Metrics</span>
                  </div>
                </div>
                <span className="text-gray-400 text-xs font-bold">➔</span>
              </button>

              <button
                onClick={signOut}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                    <LogOut size={16} className="text-red-600" />
                  </div>
                  <span className="font-semibold text-[var(--text-heading)] text-sm">Sign Out</span>
                </div>
              </button>
            </div>

            {/* My Contributions (Recent Activity) */}
            {userUpdates.length > 0 && (
              <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
                <h3 className="font-heading font-bold text-[var(--text-heading)] text-sm mb-3 px-1">My Recent Contributions</h3>
                <div className="bg-white border border-[var(--border-light)] rounded-2xl p-4 shadow-sm space-y-4">
                  {userUpdates.map((update) => {
                    const config = ACTION_CONFIG[update.action as UpdateAction] || ACTION_CONFIG.created;
                    const Icon = config.icon;
                    const station = update.station;

                    return (
                      <div key={update.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                          <Icon size={14} className={config.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text-body)] leading-snug">
                            <span className="font-semibold text-[var(--text-heading)] capitalize">{update.action.replace('_', ' ')}</span>
                            {station && (() => {
                              const AnimalIcon = ANIMAL_ICONS[station.animal_type as AnimalType] || PawPrint;
                              return (
                                <span className="text-[var(--text-body)] inline-flex items-center gap-1 ml-1">
                                  at {STATION_TYPE_LABELS[station.type as StationType]?.toLowerCase() || 'station'} <AnimalIcon size={12} />
                                </span>
                              );
                            })()}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(update.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Not Logged In — redirect to dedicated login page */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-24 h-24 rounded-3xl bg-white border border-[var(--border-light)] shadow-sm flex items-center justify-center mb-6 text-[var(--accent-primary)] opacity-80">
              <PawPrint size={48} />
            </div>
            <h2 className="font-heading text-2xl font-bold text-[var(--text-heading)] mb-3">
              Join the Network
            </h2>
            <p className="text-sm text-[var(--text-body)] leading-relaxed mb-8 max-w-[260px]">
              Sign in to map feeding spots, report animal emergencies, and volunteer.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-14 bg-[var(--accent-primary)] text-white rounded-2xl shadow-sm font-semibold
                         hover:opacity-90 active:scale-[0.98] transition-all duration-200"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
