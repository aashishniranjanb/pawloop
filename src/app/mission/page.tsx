'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle2, Target, Zap, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/layout/bottom-nav';
import { useAuth } from '@/lib/auth-context';
import { useRealtime } from '@/lib/use-realtime';
import { useGeolocation, getDistanceKm } from '@/lib/use-geolocation';
import { calculateHealthScore, STATION_TYPE_LABELS, type Station, type TaskType } from '@/lib/types';
import { ANIMAL_ICONS, TASK_ICONS } from '@/lib/icons';
import { PawPrint, Target as TargetIcon } from 'lucide-react';
import { calculateConfidenceState } from '@/lib/intelligence';
import { useDemoContext } from '@/lib/demo-context';
import { supabase } from '@/utils/supabase/client';

export default function MissionPage() {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const { demoMode, setDemoMode } = useDemoContext();
  const { stations, updateStation, createUpdate, updateVolunteerState } = useRealtime(demoMode);
  const { location: userLocation } = useGeolocation();

  const [missionActive, setMissionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  
  // Session Summary Modal States
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummaryData, setSessionSummaryData] = useState({ completed: 0, time: '0:00' });

  // Session timer
  useEffect(() => {
    if (!missionActive || !sessionStart) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [missionActive, sessionStart]);

  // Generate tasks from stations needing attention with Route Optimization & Clustering
  const missionTasks = useMemo(() => {
    const needsAttention = stations.filter((s) => {
      const conf = calculateConfidenceState(s);
      return (
        s.status === 'needs_refill' ||
        s.status === 'needs_cleanup' ||
        s.status === 'degrading' ||
        s.status === 'critical' ||
        conf === 'stale' ||
        conf === 'abandoned'
      );
    });

    return needsAttention
      .map((station) => {
        const distance = userLocation
          ? getDistanceKm(userLocation.lat, userLocation.lng, station.lat, station.lng)
          : 999;
        const { percentage } = calculateHealthScore(station);
        let urgency = 100 - percentage;
        
        let type: TaskType = station.status === 'needs_cleanup' ? 'cleanup' : station.type === 'water' ? 'refill_water' : 'feeding';
        const conf = calculateConfidenceState(station);
        if (station.status === 'active' && (conf === 'stale' || conf === 'abandoned')) {
          type = 'verification';
          urgency = 50; // Moderate urgency for verification
        }

        // Count nearby urgent stations within a 1km cluster radius
        const nearbyUrgentCount = needsAttention.filter(other => 
          other.id !== station.id && 
          getDistanceKm(station.lat, station.lng, other.lat, other.lng) < 1.0
        ).length;

        // Route Optimization Score: Urgent priorities + cluster bonuses - travel distance penalty
        const score = (urgency * 1.5) + (nearbyUrgentCount * 8) - (distance * 2.5);

        return {
          id: station.id,
          station,
          distance,
          urgency,
          type,
          nearbyUrgentCount,
          isBundle: nearbyUrgentCount >= 2,
          confidenceState: conf,
          score,
          etaMinutes: Math.round(distance * 12), // ~5 km/h walking
        };
      })
      .sort((a, b) => b.score - a.score) // Dynamic Route Optimization sorting
      .slice(0, 10);
  }, [stations, userLocation]);

  const nearbyHealthy = useMemo(() => {
    if (!userLocation) return [];
    return stations
      .filter((s) => {
        const dist = getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng);
        return dist < 2 && s.status === 'active';
      })
      .slice(0, 5);
  }, [stations, userLocation]);

  const startMission = async () => {
    if (!user) { signInWithGoogle(); return; }
    setMissionActive(true);
    setSessionStart(new Date());
    setCompletedCount(0);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    // Set volunteer state in profiles to on_mission
    try {
      await updateVolunteerState('on_mission');
      
      // Persist generated tasks to DB for analytics (skip in Demo Mode)
      if (!demoMode && missionTasks.length > 0) {
        const tasksToInsert = missionTasks.map((mt) => ({
          type: mt.type,
          station_id: mt.id,
          assigned_to: user.id,
          status: 'in_progress',
          priority: mt.urgency > 80 ? 3 : mt.urgency > 50 ? 2 : 1,
        }));
        await supabase.from('tasks').insert(tasksToInsert);
      }
    } catch (err) {
      console.warn('Failed to start mission operations:', err);
    }
  };

  const completeTask = async (station: Station) => {
    if (!user) return;
    setActiveTaskId(station.id);

    try {
      await updateStation(station.id, {
        status: 'active',
        cleanliness: 5,
        water_level: station.type === 'water' ? 'full' : station.water_level,
        last_refill: new Date().toISOString(),
      });

      await createUpdate({
        station_id: station.id,
        user_id: user.id,
        action: 'completed_task',
        notes: `Mission task completed during volunteer session.`,
      });

      if (!demoMode) {
        await supabase.from('tasks')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('station_id', station.id)
          .eq('assigned_to', user.id)
          .eq('status', 'in_progress');
      }

      setCompletedCount((prev) => prev + 1);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    } catch (err) {
      console.error('Task completion error:', err);
    } finally {
      setActiveTaskId(null);
    }
  };

  const endMission = async (endState: 'offline' | 'resting') => {
    setSessionSummaryData({ completed: completedCount, time: formatTime(elapsed) });
    setMissionActive(false);
    setSessionStart(null);
    setElapsed(0);
    setShowSummaryModal(true);

    // Update volunteer state to chosen end state
    try {
      await updateVolunteerState(endState);
    } catch (err) {
      console.warn('Failed to update state in DB:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
          <div className="flex-1">
            <h1 className="font-heading text-xl font-bold text-[var(--text-heading)] leading-tight">
              Mission Mode
            </h1>
            <p className="text-xs text-[var(--text-body)] font-medium">
              {missionActive ? 'Session active' : 'Volunteer coordination'}
            </p>
          </div>

          {missionActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3B82F6]/20 rounded-full">
              <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#3B82F6]">
                {formatTime(elapsed)}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                demoMode 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${demoMode ? 'bg-blue-500' : 'bg-green-500'}`} />
              {demoMode ? 'DEMO MODE' : 'LIVE DATA'}
            </button>
          )}
        </div>
      </header>

      <div className="scroll-area flex-1 px-5 pt-2 pb-[120px]">
        {!missionActive ? (
          /* ── Pre-Mission ── */
          <div className="space-y-6">
            {/* Mission Start Card */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-float p-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-4">
                <Target size={28} className="text-[var(--accent-primary)]" />
              </div>
              <h2 className="font-heading text-xl font-bold text-[var(--text-heading)] mb-2">
                Start Volunteer Session
              </h2>
              <p className="text-sm text-[var(--text-body)] mb-6 max-w-[280px] mx-auto">
                The system will generate nearby urgent tasks and guide your route through stations needing attention.
              </p>

              {/* Stats Preview */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-red-50 border border-red-200 rounded-xl py-3 px-2">
                  <div className="text-lg font-bold text-red-600">{missionTasks.length}</div>
                  <div className="text-[10px] text-red-700 font-medium uppercase">Tasks</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl py-3 px-2">
                  <div className="text-lg font-bold text-blue-600">{nearbyHealthy.length}</div>
                  <div className="text-[10px] text-blue-700 font-medium uppercase">Healthy</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl py-3 px-2">
                  <div className="text-lg font-bold text-green-600">
                    {userLocation ? `${Math.round(missionTasks.reduce((sum, t) => sum + t.distance, 0) * 10) / 10} km` : '—'}
                  </div>
                  <div className="text-[10px] text-green-700 font-medium uppercase">Total</div>
                </div>
              </div>

              <button
                onClick={startMission}
                className="w-full h-14 bg-[#3B82F6] text-white rounded-2xl font-bold text-base shadow-[0_0_15px_rgba(59,130,246,0.4)]
                           hover:bg-blue-500 active:scale-[0.98] transition-all
                           flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                Start Session
              </button>
            </div>

            {/* Upcoming Tasks Preview */}
            {missionTasks.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider mb-3">
                  Nearby Optimized Tasks ({missionTasks.length})
                </h3>
                <div className="space-y-2">
                  {missionTasks.slice(0, 5).map((task, i) => (
                    <div
                      key={task.id}
                      className="bg-white border border-[var(--border-light)] rounded-2xl p-4 flex items-center gap-3 animate-slide-up shadow-sm"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        task.urgency > 70 ? 'bg-red-50 border-red-200' : task.urgency > 40 ? 'bg-amber-50 border-amber-200' : 'bg-[var(--bg-subtle)] border-[var(--border-light)]'
                      }`}>
                        {(() => {
                          const Icon = ANIMAL_ICONS[task.station.animal_type] || PawPrint;
                          return <Icon size={20} className="text-[var(--text-heading)] opacity-80" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-heading)] truncate flex items-center gap-1.5 flex-wrap">
                          {STATION_TYPE_LABELS[task.station.type]}
                          {task.isBundle && (
                            <span className="text-[8px] bg-[var(--bg-subtle)] border border-[var(--border-light)] text-[var(--accent-primary)] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                              Cluster
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-body)] truncate">{task.station.notes || 'Needs attention'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-bold text-[var(--text-heading)]">
                          {task.distance < 1 ? `${Math.round(task.distance * 1000)}m` : `${task.distance.toFixed(1)}km`}
                        </div>
                        <div className="text-[10px] text-[var(--text-body)]">{task.etaMinutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Active Mission ── */
          <div className="space-y-4">
            {/* Mission Stats Bar */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 flex items-center justify-between animate-fade-in">
              <div className="text-center">
                <div className="text-xl font-bold text-[#22C55E]">{completedCount}</div>
                <div className="text-[10px] text-[var(--text-body)] font-medium uppercase">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[var(--text-heading)]">{missionTasks.length}</div>
                <div className="text-[10px] text-[var(--text-body)] font-medium uppercase">Remaining</div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => endMission('resting')}
                  className="px-3 py-2 bg-amber-950/40 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-bold transition-colors hover:bg-amber-900/60 active:scale-95 duration-100"
                >
                  Rest
                </button>
                <button
                  onClick={() => endMission('offline')}
                  className="px-3 py-2 bg-red-950/40 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors hover:bg-red-900/60 active:scale-95 duration-100"
                >
                  Finish
                </button>
              </div>
            </div>

            {/* Active Tasks */}
            <h3 className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider">
              Priority Cluster Routing
            </h3>
            <div className="space-y-3">
              {missionTasks.map((task) => {
                const isActive = activeTaskId === task.id;
                const { percentage } = calculateHealthScore(task.station);

                // Determine Confidence State details
                const isVerified = task.confidenceState === 'verified';
                const isCommunity = task.confidenceState === 'community_confirmed';
                const confidenceLabel = isVerified ? 'High Confidence' : isCommunity ? 'Medium Confidence' : 'Low Confidence (Stale)';
                const confidenceColor = isVerified ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/30' : isCommunity ? 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse';

                return (
                  <div
                    key={task.id}
                    className={`bg-white border rounded-2xl p-4 transition-all relative overflow-hidden ${isActive ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] shadow-md scale-[1.01]' : 'border-[var(--border-light)] hover:border-[var(--accent-primary)]/30'}`}
                  >
                    {/* Bundle Cluster Indicator Banner */}
                    {task.isBundle && (
                      <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-light)] flex items-center justify-between">
                        <span className="text-[9px] font-bold text-[var(--accent-primary)] flex items-center gap-1">
                          ⚡ MULTI-POINT MISSION CLUSTER
                        </span>
                        <span className="text-[8px] bg-blue-100 text-[var(--accent-primary)] font-extrabold px-1.5 py-0.2 rounded-full">
                          {task.nearbyUrgentCount + 1} Spots nearby
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        task.urgency > 70 ? 'bg-red-50 border-red-200' : task.urgency > 40 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                      }`}>
                        {(() => {
                          const Icon = ANIMAL_ICONS[task.station.animal_type] || PawPrint;
                          return <Icon size={20} className="text-[var(--text-heading)] opacity-80" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-heading)] leading-snug flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const TaskIcon = TASK_ICONS[task.type] || TargetIcon;
                            return <TaskIcon size={16} className="inline mr-1.5 opacity-90" />;
                          })()}
                          {STATION_TYPE_LABELS[task.station.type]}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin size={10} className="text-gray-500" />
                          <span className="text-[10px] text-[var(--text-body)] font-medium">
                            {task.distance < 1 ? `${Math.round(task.distance * 1000)}m` : `${task.distance.toFixed(1)}km`} away
                          </span>
                          <span className="text-[10px] text-gray-400">•</span>
                          <Clock size={10} className="text-gray-500" />
                          <span className="text-[10px] text-[var(--text-body)] font-medium">{task.etaMinutes} min</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={`text-xs font-bold ${
                          percentage > 60 ? 'text-[#22C55E]' : percentage > 30 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {percentage}%
                        </div>
                        <span className="text-[9px] text-[var(--text-body)] font-semibold tracking-wider uppercase">health</span>
                      </div>
                    </div>

                    {/* Mission Confidence Indicator Badge */}
                    <div className="mb-3.5 pl-[52px] flex items-center">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${confidenceColor} flex items-center gap-1`}>
                        <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                        {confidenceLabel}
                      </span>
                    </div>

                    {task.station.notes && (
                      <p className="text-xs text-[var(--text-body)] mb-3.5 pl-[52px] leading-relaxed italic border-l-2 border-[var(--border-light)]">{task.station.notes}</p>
                    )}

                    <button
                      onClick={() => completeTask(task.station)}
                      disabled={isActive}
                      className="w-full py-2.5 bg-[#3B82F6] text-white rounded-xl text-sm font-semibold
                                 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)]
                                 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isActive ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          Complete Task
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {missionTasks.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-[#22C55E]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#22C55E]/30">
                  <CheckCircle2 size={28} className="text-[#22C55E]" />
                </div>
                <h3 className="font-heading text-lg font-bold text-[var(--text-heading)] mb-2">All Clear!</h3>
                <p className="text-sm text-[var(--text-body)]">No stations need attention nearby. Great work!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Session Summary Modal (Volunteer State Engine) ─── */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="w-full max-w-[340px] bg-white rounded-[32px] p-6 shadow-float border border-[var(--border-light)] overflow-hidden relative animate-scale-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-light)] flex items-center justify-center mx-auto mb-3 text-[var(--accent-primary)]">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-heading text-lg font-extrabold text-[var(--text-heading)]">Session Completed!</h3>
              <p className="text-xs text-[var(--text-body)] mt-1 font-semibold uppercase tracking-wider">Ecosystem Coordinated</p>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-3.5 bg-[var(--bg-subtle)] rounded-2xl p-4 border border-[var(--border-light)] mb-6">
              <div className="text-center border-r border-[var(--border-light)]">
                <span className="text-2xl font-heading font-extrabold text-[var(--accent-primary)]">{sessionSummaryData.completed}</span>
                <span className="text-[9px] text-[var(--text-body)] font-bold block uppercase tracking-wider mt-0.5">Tasks Done</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-heading font-extrabold text-[var(--text-heading)] font-mono">{sessionSummaryData.time}</span>
                <span className="text-[9px] text-[var(--text-body)] font-bold block uppercase tracking-wider mt-0.5">Active Time</span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-body)] text-center mb-6 leading-relaxed">
              Your actions resolved critical depletion warnings and boosted localized ecosystem health across the Chennai pilot zone!
            </p>

            {/* Availability engine selection */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold text-[var(--text-body)] uppercase tracking-wide text-left px-1">Select Next Status Availability</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    await updateVolunteerState('available');
                    setShowSummaryModal(false);
                  }}
                  className="py-2.5 rounded-xl border border-[#22C55E]/30 text-[#22C55E] bg-[#22C55E]/10 text-xs font-bold hover:bg-[#22C55E]/20 transition-colors"
                >
                  🟢 Go Available
                </button>
                <button
                  onClick={async () => {
                    await updateVolunteerState('resting');
                    setShowSummaryModal(false);
                  }}
                  className="py-2.5 rounded-xl border border-amber-500/30 text-amber-500 bg-amber-500/10 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                >
                  🟡 Standby (Rest)
                </button>
              </div>
              
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                }}
                className="w-full py-3 bg-white text-[var(--text-heading)] rounded-xl text-xs font-bold tracking-wide hover:bg-[var(--bg-subtle)] transition-colors border border-[var(--border-light)]"
              >
                Dismiss & Return
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
