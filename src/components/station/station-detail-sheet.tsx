'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Droplets,
  Sparkles,
  Clock,
  UserCheck,
  ChevronDown,
  Edit3,
  Archive,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import {
  Station,
  StationUpdate,
  STATION_TYPE_LABELS,
  ANIMAL_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  WATER_LEVEL_LABELS,
  WaterLevel,
  AnimalType,
  calculateHealthScore,
  calculateLifecycle,
  HEALTH_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_COLORS,
  CONFIDENCE_LABELS,
  CONFIDENCE_COLORS,
} from '@/lib/types';
import { calculateConfidenceState } from '@/lib/intelligence';
import { timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/utils/supabase/client';
import { ANIMAL_ICONS } from '@/lib/icons';
import { PawPrint } from 'lucide-react';
import { useDemoContext } from '@/lib/demo-context';

interface StationDetailSheetProps {
  station: Station;
  onClose: () => void;
  onArchive?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<Station>) => void;
}

// ─── Health Gauge SVG Component ──────────────────────────
function HealthGauge({ percentage, color }: { percentage: number; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="health-gauge w-full h-full" viewBox="0 0 64 64">
        <circle className="health-gauge__track" cx="32" cy="32" r={radius} />
        <circle
          className="health-gauge__fill"
          cx="32"
          cy="32"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-xs font-heading font-bold"
          style={{ color }}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
}

// ─── Snap Points ─────────────────────────────────────────
const SNAP_PEEK = 0.25;
const SNAP_HALF = 0.50;
const SNAP_FULL = 0.85;

export default function StationDetailSheet({ station, onClose, onArchive, onUpdate }: StationDetailSheetProps) {
  const { user, signInWithGoogle } = useAuth();
  const { demoMode, demoEngine } = useDemoContext();
  const { status: health, percentage: healthPercentage } = calculateHealthScore(station);
  const lifecycle = calculateLifecycle(station);
  const confidence = calculateConfidenceState(station);
  const confidenceLabel = CONFIDENCE_LABELS[confidence];
  const confidenceColor = CONFIDENCE_COLORS[confidence];

  // Sheet state
  const [snapFraction, setSnapFraction] = useState(SNAP_HALF);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartFrac = useRef(0);
  const isDragging = useRef(false);

  // Station updates
  const [updatesList, setUpdatesList] = useState<StationUpdate[]>([]);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [waterLevel, setWaterLevel] = useState<WaterLevel>(station.water_level ?? 'full');
  const [updateAction, setUpdateAction] = useState<'refilled' | 'cleaned'>('refilled');
  const [editNotes, setEditNotes] = useState(station.notes || '');
  const [submitting, setSubmitting] = useState(false);

  // Fetch updates
  useEffect(() => {
    if (demoMode) {
      setTimeout(() => {
        setUpdatesList(
          demoEngine.updates
            .filter(u => u.station_id === station.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        );
      }, 0);
      return;
    }

    const fetchUpdates = async () => {
      const { data, error } = await supabase
        .from('updates')
        .select('*')
        .eq('station_id', station.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUpdatesList(data as StationUpdate[]);
      }
    };

    fetchUpdates();

    const updatesChannel = supabase
      .channel(`station-updates-${station.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'updates', filter: `station_id=eq.${station.id}` },
        (payload) => {
          const newUpdate = payload.new as StationUpdate;
          setUpdatesList((prev) => [newUpdate, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(updatesChannel);
    };
  }, [station.id, demoMode, demoEngine]);

  // ── Drag Logic ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragStartFrac.current = snapFraction;
  }, [snapFraction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = dragStartY.current - e.touches[0].clientY;
    const vh = window.innerHeight;
    const newFrac = Math.min(SNAP_FULL, Math.max(0.1, dragStartFrac.current + dy / vh));

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.height = `${newFrac * 100}vh`;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dy = dragStartY.current - e.changedTouches[0].clientY;
    const vh = window.innerHeight;
    const currentFrac = dragStartFrac.current + dy / vh;
    const velocity = Math.abs(dy);

    if (currentFrac < 0.15) {
      onClose();
      return;
    }

    let target: number;
    if (velocity > 100) {
      target = dy > 0
        ? (currentFrac > SNAP_HALF ? SNAP_FULL : SNAP_HALF)
        : (currentFrac < SNAP_HALF ? SNAP_PEEK : SNAP_HALF);
    } else {
      const snaps = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
      target = snaps.reduce((prev, curr) =>
        Math.abs(curr - currentFrac) < Math.abs(prev - currentFrac) ? curr : prev
      );
    }

    if (sheetRef.current) {
      sheetRef.current.style.transition = `height 350ms cubic-bezier(0.16, 1, 0.3, 1)`;
      sheetRef.current.style.height = `${target * 100}vh`;
    }
    setSnapFraction(target);
  }, [onClose]);

  // ── Actions ────────────────────────────────────────────
  const handleVolunteerClaim = async () => {
    if (!user) { signInWithGoogle(); return; }
    try {
      setSubmitting(true);
      const { error: stationError } = await supabase
        .from('stations')
        .update({
          volunteer_id: user.id,
          status: 'active',
          cleanliness: 5,
          updated_at: new Date().toISOString(),
        })
        .eq('id', station.id);
      if (stationError) throw stationError;

      await supabase.from('updates').insert({
        station_id: station.id,
        user_id: user.id,
        action: 'claimed',
        notes: 'Station claimed by volunteer.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error claiming station:', err);
      alert('Failed: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpdate = async () => {
    if (!user) return;
    try {
      setSubmitting(true);
      const nowStr = new Date().toISOString();

      const sanitizedNotes = updateAction === 'refilled'
        ? `Refilled food and set water to ${waterLevel}.`
        : 'Cleaned the station area.';

      if (!demoMode) {
        const { error: stationError } = await supabase
          .from('stations')
          .update({
            status: 'active',
            water_level: updateAction === 'refilled' ? waterLevel : station.water_level,
            cleanliness: updateAction === 'cleaned' ? 5 : station.cleanliness,
            last_refill: updateAction === 'refilled' ? nowStr : station.last_refill,
            updated_at: nowStr,
          })
          .eq('id', station.id);
        if (stationError) throw stationError;
      }

      if (demoMode) {
        const updatePayload: Partial<StationUpdate> = {
          station_id: station.id,
          user_id: user?.id || 'demo-user',
          action: updateAction,
          notes: sanitizedNotes,
          created_at: nowStr,
        };
        demoEngine.createUpdateDemo(updatePayload);
      } else {
        const { error } = await supabase
          .from('updates')
          .insert({
            station_id: station.id,
            user_id: user!.id,
            action: updateAction,
            notes: sanitizedNotes,
          });

        if (error) throw error;
      }
      setShowUpdateForm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error updating:', err);
      alert('Failed: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!user) return;
    try {
      setSubmitting(true);
      onUpdate?.(station.id, { notes: editNotes });
      setShowEditMode(false);
    } catch (err: unknown) {
      console.error('Error editing:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = () => {
    onArchive?.(station.id);
    onClose();
  };

  const AnimalIcon = ANIMAL_ICONS[station.animal_type as AnimalType] || PawPrint;
  const statusColor = STATUS_COLORS[station.status] || '#999';
  const lifecycleColor = LIFECYCLE_COLORS[lifecycle];

  return (
    <>
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="sheet-container overflow-hidden flex flex-col"
        style={{ height: `${snapFraction * 100}vh`, maxWidth: '640px', margin: '0 auto' }}
      >
        {/* Drag Handle */}
        <div
          className="sheet-handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sheet-handle__bar" />
        </div>

        {/* ── Peek Content ──────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 pb-3">
          {/* Health Gauge */}
          <HealthGauge percentage={healthPercentage} color={HEALTH_COLORS[health]} />

          {/* Station Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <AnimalIcon size={24} className="text-brand-graphite opacity-80" />
              <div>
                <h2 className="font-heading text-base font-semibold text-brand-graphite leading-tight">
                  {STATION_TYPE_LABELS[station.type]}
                </h2>
                <span className="text-xs text-gray-500">
                  {ANIMAL_TYPE_LABELS[station.animal_type]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusColor }}
              />
              <span className="text-xs font-medium" style={{ color: statusColor }}>
                {STATUS_LABELS[station.status]}
              </span>
              {/* Lifecycle Badge */}
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: `${lifecycleColor}15`, color: lifecycleColor }}
              >
                {LIFECYCLE_LABELS[lifecycle]}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {station.updated_at ? timeAgo(station.updated_at) : ''}
              </span>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center
                       hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <ChevronDown size={16} className="text-gray-500" />
          </button>
        </div>

        {/* ── Scrollable Content ─────────────────────────── */}
        <div className="scroll-area flex-1 px-5 pb-8">
          {/* Confidence / Staleness Banner */}
          <div 
            className="flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 animate-fade-in"
            style={{ 
               backgroundColor: `${confidenceColor}10`, 
               borderColor: `${confidenceColor}30`,
               color: confidenceColor 
            }}
          >
            {confidence === 'abandoned' || confidence === 'stale' ? (
              <AlertTriangle size={14} className="flex-shrink-0" />
            ) : (
              <Shield size={14} className="flex-shrink-0" />
            )}
            <span className="text-xs font-medium">{confidenceLabel}</span>
            {station.community_group && (
              <span className="text-[10px] ml-auto font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${confidenceColor}20` }}>
                {station.community_group}
              </span>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {station.water_level && (
              <div className="flex flex-col items-center gap-1 py-3 bg-blue-50/80 rounded-2xl">
                <Droplets size={18} className="text-status-water" />
                <span className="text-xs font-medium text-gray-800">
                  {WATER_LEVEL_LABELS[station.water_level]}
                </span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider">Water</span>
              </div>
            )}
            <div className="flex flex-col items-center gap-1 py-3 bg-green-50/80 rounded-2xl">
              <Sparkles size={18} className="text-status-active" />
              <span className="text-xs font-medium text-gray-800">
                {station.cleanliness}/5
              </span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider">Clean</span>
            </div>
            {station.last_refill && (
              <div className="flex flex-col items-center gap-1 py-3 bg-amber-50/80 rounded-2xl">
                <Clock size={18} className="text-status-cleanup" />
                <span className="text-xs font-medium text-gray-800">
                  {timeAgo(station.last_refill)}
                </span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider">Refill</span>
              </div>
            )}
            {station.volunteer_id && (
              <div className="flex flex-col items-center gap-1 py-3 bg-purple-50/80 rounded-2xl">
                <UserCheck size={18} className="text-purple-500" />
                <span className="text-xs font-medium text-gray-800">Assigned</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider">Volunteer</span>
              </div>
            )}
          </div>

          {/* Notes — with edit mode */}
          {showEditMode ? (
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-3 animate-scale-in">
              <h3 className="font-heading text-sm font-semibold text-brand-graphite">Edit Station</h3>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Station notes..."
                rows={3}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                           placeholder:text-gray-400 focus:outline-none focus:border-brand-forest
                           focus:ring-2 focus:ring-brand-forest/20 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-brand-forest text-white rounded-xl text-sm font-semibold
                             hover:bg-brand-forest-light transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowEditMode(false)}
                  className="py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : station.notes ? (
            <div className="bg-brand-cream rounded-2xl px-4 py-3 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">{station.notes}</p>
            </div>
          ) : null}

          {/* Quick Actions */}
          {!showUpdateForm && !showEditMode && !showArchiveConfirm && (
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <button
                  id="btn-update-status"
                  onClick={() => {
                    if (!user) { signInWithGoogle(); return; }
                    setShowUpdateForm(true);
                  }}
                  disabled={submitting}
                  className="flex-1 py-3 bg-brand-forest text-white rounded-2xl text-sm font-semibold
                             hover:bg-brand-forest-light active:scale-[0.98]
                             transition-all duration-200 disabled:opacity-50"
                >
                  🍽 Update Status
                </button>
                {!station.volunteer_id && (
                  <button
                    id="btn-claim-task"
                    onClick={handleVolunteerClaim}
                    disabled={submitting}
                    className="flex-1 py-3 bg-white border-2 border-brand-forest text-brand-forest
                               rounded-2xl text-sm font-semibold
                               hover:bg-brand-forest/5 active:scale-[0.98]
                               transition-all duration-200 disabled:opacity-50"
                  >
                    {submitting ? '...' : "🙋 I'll Handle"}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!user) { signInWithGoogle(); return; }
                    setShowEditMode(true);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium
                             hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={13} /> Edit Details
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium
                             hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Archive size={13} /> Archive
                </button>
              </div>
            </div>
          )}

          {/* Archive Confirmation */}
          {showArchiveConfirm && (
            <div className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100 space-y-3 animate-scale-in">
              <p className="text-sm text-red-700 font-medium">Archive this station? It will be hidden from the map but data is preserved.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleArchive}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold
                             hover:bg-red-600 transition-colors"
                >
                  Yes, Archive
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Inline Update Form */}
          {showUpdateForm && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-4 animate-scale-in">
              <h3 className="font-heading text-sm font-semibold text-brand-graphite">
                Update Station
              </h3>

              <div className="flex gap-2">
                {(['refilled', 'cleaned'] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setUpdateAction(action)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      updateAction === action
                        ? 'bg-brand-forest/10 border-brand-forest text-brand-forest'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {action === 'refilled' ? '🍽 Refill' : '🧹 Clean'}
                  </button>
                ))}
              </div>

              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Water Level</span>
                <div className="flex gap-2">
                  {(['full', 'half', 'empty'] as WaterLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setWaterLevel(level)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        waterLevel === level
                          ? 'bg-status-water/10 border-status-water text-status-water'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      {WATER_LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitUpdate}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-brand-forest text-white rounded-xl text-sm font-semibold
                             hover:bg-brand-forest-light transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowUpdateForm(false)}
                  className="py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500
                             hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {updatesList.length > 0 && (
            <div className="mt-2">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Activity
              </h3>
              <div className="space-y-0">
                {updatesList.slice(0, 5).map((update, i) => (
                  <div key={update.id} className="flex items-start gap-3 relative">
                    {/* Timeline line */}
                    {i < Math.min(updatesList.length, 5) - 1 && (
                      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-200" />
                    )}
                    {/* Dot */}
                    <div className="w-3.5 h-3.5 rounded-full bg-brand-forest/15 flex items-center justify-center mt-0.5 flex-shrink-0 z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-forest" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        <span className="font-medium capitalize">{update.action.replace('_', ' ')}</span>
                        {update.notes && (
                          <span className="text-gray-500"> — {update.notes}</span>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400">{timeAgo(update.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
