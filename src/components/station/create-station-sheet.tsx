'use client';

import { useState } from 'react';
import { MapPin, Droplets, Utensils, Home, Trash2, CheckCircle2, type LucideIcon } from 'lucide-react';
import {
  StationType,
  StationStatus,
  ANIMAL_TYPE_LABELS,
  type AnimalType,
} from '@/lib/types';
import { ANIMAL_ICONS } from '@/lib/icons';
import { PawPrint } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

import { useOfflineSync } from '@/lib/use-offline-sync';
import { useDemoContext } from '@/lib/demo-context';

interface CreateStationSheetProps {
  coords: { lat: number; lng: number } | null;
  onClose: () => void;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const TYPE_CONFIG: Record<StationType, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  feeding: { label: 'Food', icon: Utensils, color: 'text-brand-forest', bg: 'bg-green-50' },
  water: { label: 'Water', icon: Droplets, color: 'text-brand-sky', bg: 'bg-blue-50' },
  shelter: { label: 'Shelter', icon: Home, color: 'text-brand-alert', bg: 'bg-amber-50' },
  waste: { label: 'Waste', icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-100' },
};

export default function CreateStationSheet({ coords, onClose }: CreateStationSheetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const offlineSync = useOfflineSync();
  const { demoMode, demoEngine } = useDemoContext();
  const [stationType, setStationType] = useState<StationType>('feeding');
  const [animalType, setAnimalType] = useState<AnimalType>('dog');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !demoMode) { router.push('/login'); return; }

    setSubmitting(true);
    const lat = coords?.lat ?? 12.9816;
    const lng = coords?.lng ?? 80.2204;

    const newStationId = generateUUID();
    const stationPayload = {
      id: newStationId,
      created_by: user?.id || 'demo-user',
      lat, lng,
      type: stationType,
      animal_type: animalType,
      status: 'active' as StationStatus,
      water_level: stationType === 'water' ? 'full' : null,
      cleanliness: 5,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    try {
      if (demoMode) {
        demoEngine.createStationDemo(stationPayload as any);
        demoEngine.createUpdateDemo({
          station_id: newStationId,
          user_id: user?.id || 'demo-user',
          action: 'created',
          notes: 'Support point established in Demo Mode.',
          created_at: new Date().toISOString(),
        });
      } else if (!navigator.onLine) {
        // Queue station insert mutation resiliently
        await offlineSync.addMutation('stations', 'insert', stationPayload as Record<string, unknown>);
        
        // Also queue updates insert mutation for this station
        await offlineSync.addMutation('updates', 'insert', {
          station_id: newStationId,
          user_id: user?.id,
          action: 'created',
          notes: 'Support point established offline.',
          created_at: new Date().toISOString(),
        });
      } else {
        const { data: stationData, error: stationError } = await supabase
          .from('stations')
          .insert({
            id: newStationId,
            created_by: user?.id,
            lat, lng,
            type: stationType,
            animal_type: animalType,
            status: 'active',
            water_level: stationType === 'water' ? 'full' : null,
            cleanliness: 5,
            notes: notes || null,
          }).select().single();

        if (stationError) throw stationError;

        if (stationData) {
          await supabase.from('updates').insert({
            station_id: stationData.id,
            user_id: user?.id,
            action: 'created',
            notes: 'Support point established.',
          });
        }
      }

      setSuccess(true);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Success pattern
      setTimeout(() => onClose(), 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create station. Please try again.';
      console.error('Error creating station:', err);
      setFormError(message);
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/40 animate-fade-in" />
        <div className="surface-card p-8 flex flex-col items-center animate-scale-in relative z-10 w-full max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-brand-forest" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-brand-graphite text-center">
            Station Created!
          </h2>
          <p className="text-sm text-gray-500 text-center mt-2">
            The community can now see this point on the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Sheet */}
      <div className="surface-sheet w-full max-w-lg animate-slide-up max-h-[85vh] flex flex-col">
        {/* Drag Handle */}
        <div className="sheet-handle" onClick={onClose}>
          <div className="sheet-handle__bar" />
        </div>
        
        <div className="px-5 pb-3 pt-1 border-b border-gray-100">
          <h2 className="font-heading text-lg font-semibold text-brand-graphite">
            Add Support Point
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { setFormError(null); handleSubmit(e); }} className="scroll-area flex-1 px-5 py-4 space-y-6">
          {formError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 font-medium animate-fade-in">
              {formError}
            </div>
          )}
          {/* Location */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Location
            </label>
            {coords ? (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-brand-forest/5 rounded-2xl border border-brand-forest/10">
                <MapPin size={18} className="text-brand-forest flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-brand-graphite">Selected on Map</span>
                  <span className="text-xs text-gray-500">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-brand-alert/10 rounded-2xl border border-brand-alert/20">
                <MapPin size={18} className="text-brand-alert flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-brand-graphite">Current Location</span>
                  <span className="text-xs text-gray-600">Auto-detecting...</span>
                </div>
              </div>
            )}
          </div>

          {/* Station Type */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Facility Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(TYPE_CONFIG) as StationType[]).map((type) => {
                const conf = TYPE_CONFIG[type];
                const Icon = conf.icon;
                const isSelected = stationType === type;
                
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      setStationType(type);
                    }}
                    className={`
                      flex items-center gap-3 p-3 rounded-2xl transition-all border-2
                      ${isSelected
                        ? `bg-white border-${conf.color.replace('text-', '')} shadow-sm`
                        : 'bg-white border-transparent shadow-subtle hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={`w-10 h-10 rounded-xl ${conf.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={20} className={conf.color} />
                    </div>
                    <span className={`text-sm font-semibold ${isSelected ? 'text-brand-graphite' : 'text-gray-500'}`}>
                      {conf.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animal Type */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Beneficiaries
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {(Object.keys(ANIMAL_TYPE_LABELS) as AnimalType[]).map((type) => {
                const isSelected = animalType === type;
                const AnimalIcon = ANIMAL_ICONS[type] || PawPrint;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      setAnimalType(type);
                    }}
                    className={`
                      flex flex-col items-center justify-center min-w-[72px] p-2 rounded-2xl transition-all border-2 flex-shrink-0
                      ${isSelected
                        ? 'bg-brand-forest/5 border-brand-forest'
                        : 'bg-white border-transparent shadow-subtle'
                      }
                    `}
                  >
                    <AnimalIcon size={24} className={`mb-1 opacity-80 ${isSelected ? 'text-brand-graphite' : 'text-gray-500'}`} strokeWidth={isSelected ? 2.5 : 2} />
                    <span className={`text-xs font-medium ${isSelected ? 'text-brand-graphite' : 'text-gray-500'}`}>
                      {ANIMAL_TYPE_LABELS[type]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>



          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Details
            </label>
            <textarea
              id="input-station-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g. "3 friendly dogs gather here around 6 PM"'
              rows={3}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm
                         placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-brand-forest focus:ring-4 focus:ring-brand-forest/10
                         transition-all resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 bg-brand-forest text-white rounded-2xl font-semibold text-base shadow-float
                       hover:bg-brand-forest-light active:scale-[0.98]
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Support Point'}
          </button>

          {/* Bottom padding for safe area */}
          <div className="h-6" />
        </form>
      </div>
    </div>
  );
}
