'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Navigation, AlertTriangle, PawPrint } from 'lucide-react';
import {
  AnimalType,
  ReportCondition,
  ANIMAL_TYPE_LABELS,
  CONDITION_LABELS,
} from '@/lib/types';
import BottomNav from '@/components/layout/bottom-nav';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/utils/supabase/client';
import { ANIMAL_ICONS, CONDITION_ICONS } from '@/lib/icons';

import { useOfflineSync } from '@/lib/use-offline-sync';
import { useDemoContext } from '@/lib/demo-context';

export default function ReportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const offlineSync = useOfflineSync();
  const { demoMode, demoEngine } = useDemoContext();
  const [animalType, setAnimalType] = useState<AnimalType>('dog');
  const [condition, setCondition] = useState<ReportCondition>('injured');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting location...');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setTimeout(() => setLocationStatus('GPS not supported'), 0);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('Location acquired');
      },
      (error) => {
        console.warn(`Geolocation error [code=${error.code}]: ${error.message}`);
        setLocationStatus(
          error.code === 1 ? 'Location permission denied' :
          error.code === 2 ? 'Location unavailable' :
          error.code === 3 ? 'Location request timed out' :
          'Failed to get location'
        );
        setCoords({ lat: 12.9816, lng: 80.2204 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !demoMode) { router.push('/login'); return; }
    setFormError(null);
    setSubmitting(true);
    const lat = coords?.lat ?? 12.9816;
    const lng = coords?.lng ?? 80.2204;

    // Sanitize notes
    const sanitizedNotes = notes.trim().slice(0, 500) || null;

    const reportPayload = {
      id: crypto.randomUUID(),
      reported_by: user?.id || 'demo-user',
      animal_type: animalType,
      condition,
      lat, lng,
      notes: sanitizedNotes,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    try {
      if (demoMode) {
        demoEngine.createReportDemo(reportPayload as any);
      } else if (!navigator.onLine) {
        await offlineSync.addMutation('reports', 'insert', reportPayload as Record<string, unknown>);
      } else {
        const { error } = await supabase
          .from('reports')
          .insert({
            reported_by: user!.id,
            animal_type: animalType,
            condition,
            lat, lng,
            notes: sanitizedNotes,
            status: 'open',
          });

        if (error) throw error;
      }
      
      setSuccess(true);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      setTimeout(() => router.push('/'), 1500);
    } catch (err: unknown) {
      console.error('Error:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to submit report. Please try again.');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-200 text-red-500">
          <AlertTriangle size={36} strokeWidth={2.5} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-[var(--text-heading)] mb-2">Report Broadcasted</h1>
        <p className="text-[var(--text-body)]">The network has been alerted. Thank you for acting quickly.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)] overflow-hidden">
      {/* Header */}
      <header className="px-4 pt-10 pb-4 bg-[var(--bg-main)] z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-white border border-[var(--border-light)] flex items-center justify-center hover:bg-[var(--bg-subtle)] transition-colors duration-200"
            aria-label="Go back to map"
          >
            <ArrowLeft size={20} className="text-[var(--text-body)]" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold text-[var(--text-heading)] leading-tight">
              Report Emergency
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="scroll-area flex-1 px-5 pt-2 pb-[120px] space-y-6">

        {/* Inline Error Display */}
        {formError && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 font-medium animate-fade-in">
            {formError}
          </div>
        )}
        
        {/* Animal Type */}
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider mb-2 block">
            Animal
          </label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {(Object.keys(ANIMAL_TYPE_LABELS) as AnimalType[]).map((type) => {
              const isSelected = animalType === type;
              const Icon = ANIMAL_ICONS[type] || PawPrint;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    setAnimalType(type);
                  }}
                  className={`
                    flex flex-col items-center justify-center min-w-[72px] p-2.5 rounded-2xl transition-colors duration-200 border-2 flex-shrink-0
                    ${isSelected
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-white border-[var(--border-light)] text-[var(--text-body)] hover:border-red-200 hover:text-red-500'
                    }
                  `}
                >
                  <Icon size={24} className="mb-1.5" strokeWidth={isSelected ? 2.5 : 2} />
                  <span className={`text-xs font-medium ${isSelected ? 'text-red-900' : 'text-[var(--text-body)]'}`}>
                    {ANIMAL_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition */}
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider mb-2 block">
            Situation
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(CONDITION_LABELS) as ReportCondition[]).map((cond) => {
              const isSelected = condition === cond;
              const Icon = CONDITION_ICONS[cond] || AlertTriangle;
              return (
                <button
                  key={cond}
                  type="button"
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    setCondition(cond);
                  }}
                  className={`
                    flex items-center gap-3 p-4 rounded-2xl transition-colors duration-200 border-2 text-left
                    ${isSelected
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-white border-[var(--border-light)] text-[var(--text-body)] hover:border-red-200 hover:text-red-500'
                    }
                  `}
                >
                  <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-red-700' : 'text-[var(--text-body)]'}`}>
                    {CONDITION_LABELS[cond]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider mb-2 block">
            Exact Location
          </label>
          <button
            type="button"
            onClick={detectLocation}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[var(--border-light)] rounded-2xl text-left shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--bg-subtle)] rounded-full flex items-center justify-center">
                <Navigation size={18} className="text-[var(--accent-primary)]" />
              </div>
              <div>
                <span className="font-semibold text-[var(--text-heading)] text-sm block mb-0.5">
                  {coords ? 'Location Acquired' : 'Detecting GPS…'}
                </span>
                <span className="text-xs text-[var(--text-body)] block">
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : locationStatus}
                </span>
              </div>
            </div>
            <span className="text-[var(--accent-primary)] text-xs font-semibold">Update</span>
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-semibold text-[var(--text-body)] uppercase tracking-wider mb-2 block">
            Additional Details (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the animal or situation…"
            rows={3}
            className="w-full px-4 py-3.5 bg-white border border-[var(--border-light)] rounded-2xl text-sm text-[var(--text-heading)]
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 resize-none shadow-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 bg-[#EB5757] text-white rounded-2xl font-bold text-base shadow-float
                     hover:bg-red-600 active:scale-[0.98]
                     transition-all duration-200 disabled:opacity-50"
        >
          {submitting ? 'Broadcasting…' : 'Broadcast Emergency'}
        </button>
      </form>

      <BottomNav />
    </div>
  );
}
