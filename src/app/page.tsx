'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/layout/bottom-nav';
import CreateStationSheet from '@/components/station/create-station-sheet';
import StationDetailSheet from '@/components/station/station-detail-sheet';
import ReportDetailSheet from '@/components/station/report-detail-sheet';
import SyncIndicator from '@/components/layout/sync-indicator';
import { Station, AnimalReport } from '@/lib/types';
import { Settings, Filter, ChevronRight, X, Play, Activity, Flame, BarChart2, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRealtime } from '@/lib/use-realtime';
import { useGeolocation, getDistanceKm } from '@/lib/use-geolocation';
import { timeAgo } from '@/lib/utils';
import { useIntelligence } from '@/hooks/use-intelligence';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/layout/notification-center';
import InsightsPanel from '@/components/layout/insights-panel';
import MapFilterBar, { FilterCategory } from '@/components/map/map-filter-bar';
import { useDemoContext } from '@/lib/demo-context';

// Dynamic import — Leaflet requires window
const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--bg-main)] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-3 border-[var(--accent-primary)] border-t-transparent animate-spin" />
    </div>
  ),
});

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // App state
  const { demoMode, setDemoMode } = useDemoContext();
  const [filterType, setFilterType] = useState<FilterCategory>('all');

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newStationCoords, setNewStationCoords] = useState<{ lat: number; lng: number } | null>(null);

  // UI State for progressive disclosure
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  // Live Data & Engines
  const { 
    stations, 
    reports, 
    updates, 
    offlineSync, 
    archiveStation, 
    updateStation, 
    resolveReport,
    claimReport,
    environmentState
  } = useRealtime(demoMode);

  const { location: userLocation } = useGeolocation();

  // Computed state
  const selectedStation = useMemo(() => 
    selectedStationId ? stations.find(s => s.id === selectedStationId) || null : null, 
  [selectedStationId, stations]);

  const selectedReport = useMemo(() => 
    selectedReportId ? reports.find(r => r.id === selectedReportId) || null : null, 
  [selectedReportId, reports]);

  const activeCount = stations.filter(s => s.status === 'active').length;
  const criticalStations = stations.filter(s => s.status === 'critical' || s.status === 'needs_cleanup' || s.status === 'needs_refill');
  const waterNeeded = stations.filter(s => s.status === 'needs_refill').length;
  const cleanupNeeded = stations.filter(s => s.status === 'needs_cleanup').length;
  
  // Geolocation contextual filtering (within ~5km)
  const nearbyStations = useMemo(() => {
    if (!userLocation) return stations;
    return stations.filter(s => getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng) < 5);
  }, [stations, userLocation]);

  // Find nearest critical station for mission card
  const nearestCritical = useMemo(() => {
    if (!userLocation) return null;
    const criticals = nearbyStations.filter(s => 
      s.status === 'needs_refill' || s.status === 'needs_cleanup' || s.status === 'critical'
    );
    if (criticals.length === 0) return null;
    
    let nearest = criticals[0];
    let minDist = getDistanceKm(userLocation.lat, userLocation.lng, nearest.lat, nearest.lng);
    
    for (let i = 1; i < criticals.length; i++) {
      const dist = getDistanceKm(userLocation.lat, userLocation.lng, criticals[i].lat, criticals[i].lng);
      if (dist < minDist) {
        nearest = criticals[i];
        minDist = dist;
      }
    }
    
    return { station: nearest, distanceKm: minDist };
  }, [nearbyStations, userLocation]);

  const latestUpdates = useMemo(() => updates.slice(0, 5), [updates]);
  const [currentTickerIdx, setCurrentTickerIdx] = useState(0);

  // Intelligence Insights fetched from server
  const { insights } = useIntelligence(demoMode);

  // Auto-advance ticker
  useEffect(() => {
    if (latestUpdates.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentTickerIdx((prev) => (prev + 1) % latestUpdates.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [latestUpdates]);

  const handleStationSelect = useCallback((station: Station) => {
    setSelectedStationId(station.id);
  }, []);

  const handleReportSelect = useCallback((report: AnimalReport) => {
    setSelectedReportId(report.id);
  }, []);

  const handleAddStation = useCallback((lat: number, lng: number) => {
    if (!user && !demoMode) { 
      router.push('/login'); 
      return; 
    }
    if (navigator.vibrate) navigator.vibrate(50);
    setNewStationCoords({ lat, lng });
    setShowCreateSheet(true);
  }, [user, demoMode, router]);

  const hasCritical = criticalStations.length > 0;

  return (
    <div className="relative w-full h-full bg-[var(--bg-main)] overflow-hidden">
      
      {/* Offline Sync Indicator */}
      <SyncIndicator 
        status={offlineSync.syncStatus} 
        pendingCount={offlineSync.pendingCount} 
        onRetry={offlineSync.retrySync} 
      />

      <MapView
        stations={stations}
        reports={reports}
        updates={updates}
        showHeatmap={showHeatmap}
        onStationSelect={handleStationSelect}
        onReportSelect={handleReportSelect}
        onAddStation={handleAddStation}
        filterType={filterType}
        environmentState={demoMode ? environmentState : undefined}
      />

      {/* ─── MINIMAL HUD ──────────────────────────────────────── */}

      {/* Top Row: Status Pill + Action Icons */}
      <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none flex items-start justify-between gap-2">
        
        {/* Status Pill — THE dominant element */}
        <button
          onClick={() => {
            if (hasCritical) {
              setFilterType('urgent');
            }
          }}
          className={`
            pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl
            backdrop-blur-md border shadow-float
            transition-colors duration-200
            ${hasCritical 
              ? 'bg-white border-red-200 text-red-600 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
              : 'bg-white/90 border-[var(--border-light)] text-[var(--text-heading)]'
            }
          `}
          aria-label={hasCritical ? `${criticalStations.length} critical stations need attention` : `${activeCount} stations active`}
        >
          {hasCritical ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  ⚠ {criticalStations.length} Critical
                </span>
                <span className="text-[9px] text-gray-500">
                  {waterNeeded > 0 && `${waterNeeded} water`}
                  {waterNeeded > 0 && cleanupNeeded > 0 && ' · '}
                  {cleanupNeeded > 0 && `${cleanupNeeded} cleanup`}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ✓ {activeCount} Stations Active
              </span>
            </>
          )}
        </button>

        {/* Right Action Icons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Filter Toggle */}
          <button
            onClick={() => {
              setShowFilters(!showFilters);
              setShowSettings(false);
              setShowInsights(false);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200
              ${showFilters || filterType !== 'all'
                ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]'
                : 'bg-white/90 backdrop-blur-sm border border-[var(--border-light)] text-[var(--text-body)] hover:text-[var(--accent-primary)]'
              }`}
            aria-label="Toggle map filters"
          >
            <Filter size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Heatmap */}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200
              ${showHeatmap
                ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                : 'bg-white/90 backdrop-blur-sm border border-[var(--border-light)] text-[var(--text-body)] hover:text-[var(--accent-primary)]'
              }`}
            aria-label={showHeatmap ? 'Hide activity heatmap' : 'Show activity heatmap'}
          >
            <Flame size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Insights */}
          <button
            onClick={() => {
              setShowInsights(!showInsights);
              setShowFilters(false);
              setShowSettings(false);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200
              ${showInsights
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-white/90 backdrop-blur-sm border border-[var(--border-light)] text-[var(--text-body)] hover:text-[var(--accent-primary)]'
              }`}
            aria-label="Toggle intelligence insights"
          >
            <BarChart2 size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Settings Gear (Demo toggle, notifications, command center) */}
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowFilters(false);
              setShowInsights(false);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200
              ${showSettings
                ? 'bg-[var(--bg-subtle)] text-[var(--accent-primary)]'
                : 'bg-white/90 backdrop-blur-sm border border-[var(--border-light)] text-[var(--text-body)] hover:text-[var(--accent-primary)]'
              }`}
            aria-label="Settings and controls"
          >
            <Settings size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Settings Popover */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-[1100] animate-scale-in pointer-events-auto">
          <div className="surface-glass rounded-2xl shadow-float p-3 w-[220px] space-y-2">
            {/* Demo/Live Toggle */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)]">
              <span className="text-[10px] font-bold text-[var(--text-body)] uppercase tracking-wider">Mode</span>
              <div className="flex items-center gap-1 bg-white border border-[var(--border-light)] rounded-full p-0.5">
                <button 
                  onClick={() => setDemoMode(false)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors duration-200 ${!demoMode ? 'bg-[#22C55E] text-white' : 'text-gray-500'}`}
                >
                  LIVE
                </button>
                <button 
                  onClick={() => setDemoMode(true)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors duration-200 ${demoMode ? 'bg-[#3B82F6] text-white' : 'text-gray-500'}`}
                >
                  DEMO
                </button>
              </div>
            </div>

            {demoMode && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('start-demo-tour'))}
                className="w-full flex items-center gap-2 p-2 rounded-xl bg-white hover:bg-[var(--bg-subtle)] border border-transparent hover:border-[var(--accent-primary)]/20 transition-colors duration-200 text-[var(--text-heading)]"
              >
                <Play size={14} fill="currentColor" className="text-[var(--accent-primary)]" aria-hidden="true" />
                <span className="text-[10px] font-bold">Start Guided Tour</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <NotificationCenter demoMode={demoMode} />
              <span className="text-[10px] text-gray-400">Alerts</span>
            </div>

            {/* Desktop Only: Command Center */}
            <button 
              onClick={() => router.push('/command')}
              className="hidden md:flex w-full items-center gap-2 p-2 rounded-xl bg-white hover:bg-[var(--bg-subtle)] border border-transparent hover:border-[var(--accent-primary)]/20 transition-colors duration-200 text-[var(--text-heading)]"
            >
              <Activity size={14} className="text-[var(--accent-primary)]" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Command Center</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {showFilters && (
        <div className="absolute top-16 left-4 right-4 z-[1100] animate-slide-down pointer-events-auto">
          <div className="surface-glass rounded-2xl shadow-float p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[var(--text-heading)] uppercase tracking-wider">Filter Stations</span>
              <button
                onClick={() => { setFilterType('all'); setShowFilters(false); }}
                className="text-[9px] text-[var(--text-body)] hover:text-[var(--accent-primary)] font-bold"
                aria-label="Clear filters"
              >
                Clear
              </button>
            </div>
            <MapFilterBar
              activeFilter={filterType}
              onFilterChange={(f) => { setFilterType(f); setShowFilters(false); }}
              stations={stations}
              reports={reports}
            />
          </div>
        </div>
      )}

      {/* Insights Panel (progressive disclosure) */}
      {showInsights && (
        <div className="absolute top-16 left-4 right-4 z-[1100] animate-slide-down pointer-events-auto">
          <div className="surface-glass rounded-2xl shadow-float p-1">
            <InsightsPanel insights={insights} />
          </div>
        </div>
      )}

      {/* Active Filter Indicator (when filters are closed but active) */}
      {!showFilters && filterType !== 'all' && (
        <div className="absolute top-16 left-4 z-[1000] pointer-events-auto animate-fade-in">
          <button
            onClick={() => setFilterType('all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] text-[10px] font-bold backdrop-blur-sm"
            aria-label={`Clear ${filterType} filter`}
          >
            <span className="capitalize">{filterType}</span>
            <X size={10} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ─── NEAREST CRITICAL MISSION CARD ──────────────────────── */}
      {nearestCritical && !selectedStation && !selectedReport && (
        <div 
          className="absolute z-[900] left-4 right-4 pointer-events-auto animate-slide-up"
          style={{ bottom: 'calc(110px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => router.push('/mission')}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl
                       bg-red-950/60 backdrop-blur-md border border-red-500/40
                       shadow-[0_0_24px_rgba(239,68,68,0.15)]
                       hover:bg-red-950/80 active:scale-[0.98]
                       transition-transform duration-200 text-left"
            aria-label={`Nearest critical station: ${nearestCritical.station.status === 'needs_refill' ? 'Water Refill' : 'Cleanup'} ${Math.round(nearestCritical.distanceKm * 1000)}m away`}
          >
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">⚠</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-widest block">Nearest Critical</span>
              <span className="text-sm font-bold text-white block truncate">
                {nearestCritical.station.status === 'needs_refill' ? 'Water Refill' : 'Station Cleanup'} — {
                  nearestCritical.distanceKm < 1 
                    ? `${Math.round(nearestCritical.distanceKm * 1000)}m Away` 
                    : `${nearestCritical.distanceKm.toFixed(1)}km Away`
                }
              </span>
            </div>
            <div className="flex items-center gap-1 text-red-300/80 flex-shrink-0">
              <span className="text-[10px] font-bold">Start</span>
              <ChevronRight size={14} aria-hidden="true" />
            </div>
          </button>
        </div>
      )}

      {/* ─── AMBIENT LIVE TICKER ──────────────────────────────── */}
      {latestUpdates.length > 0 && !nearestCritical && !selectedStation && !selectedReport && (
        <div 
          className="absolute left-4 right-4 z-40 overflow-hidden pointer-events-none"
          style={{ bottom: 'calc(110px + env(safe-area-inset-bottom))' }}
        >
          <div className="surface-glass rounded-full px-3 py-1.5 flex items-center gap-2 inline-flex max-w-full shadow-float">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${demoMode ? 'bg-[var(--accent-primary)]' : 'bg-[#22C55E]'}`} />
            
            <div className="flex-1 min-w-0 relative h-[16px] overflow-hidden">
              {latestUpdates.map((update, idx) => (
                <div
                  key={update.id}
                  className="absolute inset-0 flex items-center gap-1 text-[10px] whitespace-nowrap transition-all duration-500 ease-in-out"
                  style={{
                    transform: `translateY(${(idx - currentTickerIdx) * 100}%)`,
                    opacity: idx === currentTickerIdx ? 1 : 0
                  }}
                >
                  <span className="text-[var(--text-heading)] font-semibold capitalize">{update.action.replace('_', ' ')}</span>
                  {update.notes && <span className="text-[var(--text-body)] truncate max-w-[120px]">— {update.notes}</span>}
                  <span className="text-gray-400 flex-shrink-0 ml-1">• {timeAgo(update.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD STATION FAB ──────────────────────────────── */}
      {!selectedStation && !selectedReport && !showCreateSheet && (
        <button
          onClick={() => handleAddStation(userLocation?.lat || 12.9816, userLocation?.lng || 80.2204)}
          className="absolute right-4 z-40 w-[60px] h-[60px] bg-[#3B82F6] text-white rounded-full flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.5)] hover:scale-105 active:scale-95 transition-transform"
          style={{ bottom: 'calc(110px + env(safe-area-inset-bottom))' }}
          aria-label="Add New Station"
        >
          <Plus size={28} strokeWidth={3} aria-hidden="true" />
        </button>
      )}

      {/* ─── SHEETS ──────────────────────────────────────── */}

      {selectedStation && (
        <StationDetailSheet 
          station={selectedStation} 
          onClose={() => setSelectedStationId(null)} 
          onArchive={archiveStation}
          onUpdate={updateStation}
        />
      )}

      {selectedReport && (
        <ReportDetailSheet
          report={selectedReport}
          onClose={() => setSelectedReportId(null)}
          onResolve={resolveReport}
          onClaim={(id) => {
            if (user) {
              claimReport(id, user.id);
            }
          }}
        />
      )}

      {showCreateSheet && (
        <CreateStationSheet coords={newStationCoords} onClose={() => setShowCreateSheet(false)} />
      )}

      <BottomNav />

      {/* Click-away backdrop for popovers */}
      {(showSettings || showFilters || showInsights) && (
        <div 
          className="absolute inset-0 z-[1050]" 
          onClick={() => { setShowSettings(false); setShowFilters(false); setShowInsights(false); }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
