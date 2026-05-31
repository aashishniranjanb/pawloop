'use client';

import { useState } from 'react';
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  AnimalReport,
  ANIMAL_TYPE_LABELS,
  CONDITION_LABELS,
  type AnimalType,
  type ReportCondition,
} from '@/lib/types';
import { ANIMAL_ICONS, CONDITION_ICONS } from '@/lib/icons';
import { PawPrint, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const CONDITION_COLORS: Record<ReportCondition, { bg: string; text: string; border: string }> = {
  injured: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  hungry: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  aggressive: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  sick: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
};


const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-red-500', bg: 'bg-red-50', icon: AlertTriangle },
  in_progress: { label: 'In Progress', color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock },
  resolved: { label: 'Resolved', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
};

interface ReportDetailSheetProps {
  report: AnimalReport;
  onClose: () => void;
  onResolve?: (id: string, notes: string) => void;
  onClaim?: (id: string) => void;
}

export default function ReportDetailSheet({ report, onClose, onResolve, onClaim }: ReportDetailSheetProps) {
  const { user, signInWithGoogle } = useAuth();
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const conditionStyle = CONDITION_COLORS[report.condition];
  const statusConfig = STATUS_CONFIG[report.status];
  const StatusIcon = statusConfig.icon;
  const AnimalIcon = ANIMAL_ICONS[report.animal_type as AnimalType] || PawPrint;
  const ConditionIcon = CONDITION_ICONS[report.condition] || AlertTriangleIcon;

  const handleResolve = async () => {
    if (!user) { signInWithGoogle(); return; }
    setSubmitting(true);
    try {
      onResolve?.(report.id, resolveNotes);
      setTimeout(onClose, 800);
    } catch (err) {
      console.error('Resolve error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = () => {
    if (!user) { signInWithGoogle(); return; }
    onClaim?.(report.id);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Sheet */}
      <div className="sheet-container overflow-hidden flex flex-col" style={{ height: '55vh', maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div className="sheet-handle" onClick={onClose}>
          <div className="sheet-handle__bar" />
        </div>

        {/* Content */}
        <div className="scroll-area flex-1 px-5 pb-8">
          {/* Emergency Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${conditionStyle.bg} ${conditionStyle.border} mb-4`}>
            <ConditionIcon size={16} className={conditionStyle.text} />
            <span className={`text-xs font-bold uppercase tracking-wide ${conditionStyle.text}`}>
              {CONDITION_LABELS[report.condition]}
            </span>
          </div>

          {/* Animal Info */}
          <div className="flex items-center gap-3 mb-4">
            <AnimalIcon size={36} className="text-brand-graphite opacity-80" />
            <div>
              <h2 className="font-heading text-lg font-bold text-brand-graphite">
                {CONDITION_LABELS[report.condition]} {ANIMAL_TYPE_LABELS[report.animal_type as AnimalType] || report.animal_type}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                  <StatusIcon size={12} className={statusConfig.color} />
                  <span className={`text-[10px] font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                </div>
                <span className="text-xs text-gray-400">{timeAgo(report.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl mb-4">
            <MapPin size={14} className="text-gray-400" />
            <span className="text-xs text-gray-600">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
          </div>

          {/* Notes */}
          {report.notes && (
            <div className="bg-brand-cream rounded-2xl px-4 py-3 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">{report.notes}</p>
            </div>
          )}

          {/* Resolution Notes */}
          {report.resolution_notes && (
            <div className="bg-green-50 rounded-2xl px-4 py-3 mb-4 border border-green-100">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Resolution</p>
              <p className="text-sm text-gray-700">{report.resolution_notes}</p>
            </div>
          )}

          {/* Actions */}
          {report.status !== 'resolved' && !showResolveForm && (
            <div className="flex gap-2 mb-4">
              {report.status === 'open' && (
                <button
                  onClick={handleClaim}
                  className="flex-1 py-3 bg-brand-forest text-white rounded-2xl text-sm font-semibold
                             hover:bg-brand-forest-light active:scale-[0.98] transition-all"
                >
                  🙋 Respond to This
                </button>
              )}
              <button
                onClick={() => {
                  if (!user) { signInWithGoogle(); return; }
                  setShowResolveForm(true);
                }}
                className="flex-1 py-3 bg-white border-2 border-green-500 text-green-600
                           rounded-2xl text-sm font-semibold hover:bg-green-50
                           active:scale-[0.98] transition-all"
              >
                ✅ Mark Resolved
              </button>
            </div>
          )}

          {/* Resolve Form */}
          {showResolveForm && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 animate-scale-in">
              <h3 className="font-heading text-sm font-semibold text-brand-graphite">
                Resolve Report
              </h3>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="How was this resolved? (e.g., 'Animal rescued and taken to vet')"
                rows={3}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                           placeholder:text-gray-400 focus:outline-none focus:border-green-400
                           focus:ring-2 focus:ring-green-400/20 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleResolve}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold
                             hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
                <button
                  onClick={() => setShowResolveForm(false)}
                  className="py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500
                             hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
