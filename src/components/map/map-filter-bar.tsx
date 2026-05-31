'use client';

import { Droplets, Home, Trash2, AlertCircle, Dog, Cat, type LucideIcon } from 'lucide-react';
import { Station, AnimalReport } from '@/lib/types';

export type FilterCategory = 'all' | 'dogs' | 'cats' | 'water' | 'urgent' | 'cleanup' | 'shelters';

interface MapFilterBarProps {
  activeFilter: FilterCategory;
  onFilterChange: (type: FilterCategory) => void;
  stations: Station[];
  reports: AnimalReport[];
}

export default function MapFilterBar({ activeFilter, onFilterChange, stations, reports }: MapFilterBarProps) {
  
  const getCount = (type: FilterCategory) => {
    switch (type) {
      case 'all': return stations.length;
      case 'dogs': return stations.filter(s => s.animal_type === 'dog').length;
      case 'cats': return stations.filter(s => s.animal_type === 'cat').length;
      case 'water': return stations.filter(s => s.type === 'water').length;
      case 'urgent': return stations.filter(s => s.status === 'needs_refill' || s.status === 'needs_cleanup').length + reports.filter(r => r.status === 'open').length;
      case 'cleanup': return stations.filter(s => s.status === 'needs_cleanup').length;
      case 'shelters': return stations.filter(s => s.type === 'shelter').length;
      default: return 0;
    }
  };

  const FILTERS: { id: FilterCategory; label: string; icon: LucideIcon | null; count: number }[] = [
    { id: 'all', label: 'All', icon: null, count: getCount('all') },
    { id: 'dogs', label: 'Dogs', icon: Dog, count: getCount('dogs') },
    { id: 'cats', label: 'Cats', icon: Cat, count: getCount('cats') },
    { id: 'water', label: 'Water', icon: Droplets, count: getCount('water') },
    { id: 'urgent', label: 'Urgent', icon: AlertCircle, count: getCount('urgent') },
    { id: 'cleanup', label: 'Cleanup', icon: Trash2, count: getCount('cleanup') },
    { id: 'shelters', label: 'Shelters', icon: Home, count: getCount('shelters') },
  ];

  return (
    <div
      id="map-filter-bar"
      className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-2 pointer-events-auto"
    >
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        const Icon = filter.icon;
        const isUrgent = filter.id === 'urgent';

        return (
          <button
            key={filter.id}
            id={`filter-${filter.id}`}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              onFilterChange(filter.id);
            }}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold
              whitespace-nowrap transition-colors duration-200 flex-shrink-0
              ${isActive
                ? (isUrgent ? 'bg-[#EF4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]' : 'bg-[#3B82F6] text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]')
                : 'bg-[#1e293b] border border-white/10 text-gray-400 hover:text-white hover:bg-[#2d3a4f]'
              }
            `}
          >
            {Icon && <Icon size={14} strokeWidth={2.5} aria-hidden="true" />}
            {filter.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ml-0.5 ${isActive ? 'bg-white/20' : 'bg-white/5 text-gray-500'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {filter.count}
            </span>
          </button>
        );
      })}
      <div className="w-2 flex-shrink-0" />
    </div>
  );
}
