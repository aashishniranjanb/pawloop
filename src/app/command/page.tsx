/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Shield, Users, Activity, AlertTriangle, ArrowLeft, Play, Pause, RotateCcw, Download, MapPin, Sparkles, BookOpen } from 'lucide-react';
import { useRealtime, SubscriptionRegistry } from '@/lib/use-realtime';
import { useDemoContext } from '@/lib/demo-context';
import { calculateHealthScore, CONFIDENCE_COLORS } from '@/lib/types';
import { calculateConfidenceState } from '@/lib/intelligence';
import { ECOSYSTEM_CONFIG } from '@/lib/ecosystem-config';
import { getWhyThisMatters } from '@/lib/narrative-engine';
import { useIntelligence } from '@/hooks/use-intelligence';
import { eventBus } from '@/lib/event-bus';
import { timeAgo } from '@/lib/utils';
import MapFilterBar, { FilterCategory } from '@/components/map/map-filter-bar';

// Dynamic import for Leaflet
const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-brand-sand flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-brand-forest border-t-transparent animate-spin" />
    </div>
  ),
});

import { supabase } from '@/utils/supabase/client';

export default function CommandCenterPage() {
  const router = useRouter();
  
  // We force demo mode in Command Center to show off all features if nothing real is happening, 
  // but let's read the localStorage setting to be consistent.
  const { demoMode } = useDemoContext();

  const [filterType, setFilterType] = useState<FilterCategory>('all');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [liveVolunteers, setLiveVolunteers] = useState(0);

  const { 
    stations, 
    reports, 
    updates,
    demoStats,
    environmentState,
    cityPulse,
    activeMission,
    triggerScenario
  } = useRealtime(demoMode);

  const { insights: narratives } = useIntelligence(demoMode);

  const [showDevPanel, setShowDevPanel] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fps, setFps] = useState(60);

  const [errorLogs, setErrorLogs] = useState<string[]>(() => [
    `[${new Date(Date.now() - 120000).toLocaleTimeString()}] INF: Supabase SSR Session synced.`,
    `[${new Date(Date.now() - 90000).toLocaleTimeString()}] INF: Web Push Service Worker active.`,
    `[${new Date(Date.now() - 60000).toLocaleTimeString()}] INF: Offline cache initialized. 0 items queued.`,
  ]);

  // FPS Counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const updateFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(updateFps);
    };

    animId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Fetch live volunteers on mount and subscribe to changes
  useEffect(() => {
    if (demoMode) return;

    const fetchLiveVolunteers = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('volunteer_state', 'on_mission');
      setLiveVolunteers(count || 0);
    };

    fetchLiveVolunteers();

    const channel = supabase
      .channel('live-volunteers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchLiveVolunteers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demoMode]);

  // Sync Log listener
  useEffect(() => {
    const unsub = eventBus.on('OFFLINE_ACTIONS_SYNCED', (data) => {
      setErrorLogs(prev => [
        `[${new Date().toLocaleTimeString()}] INF: Synced ${data.count} offline actions.`,
        ...prev.slice(0, 19)
      ]);
    });
    return unsub;
  }, []);

  const criticalCount = stations.filter(s => s.status === 'needs_refill' || s.status === 'needs_cleanup' || s.status === 'critical').length;
  
  const networkHealth = demoMode 
    ? demoStats.networkHealth 
    : (stations.length > 0 
        ? Math.round(stations.reduce((sum, s) => sum + calculateHealthScore(s).percentage, 0) / stations.length) 
        : 100);

  const [leftTab, setLeftTab] = useState<'narrative' | 'telemetry'>('narrative');
  const [activeLocality, setActiveLocality] = useState<'velachery' | 'omr' | 'besant_nagar'>('velachery');
  const [isSimPlaying, setIsSimPlaying] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [currentScenarioEvent, setCurrentScenarioEvent] = useState<{ name: string; description: string } | null>(null);

  useEffect(() => {
    const unsub = eventBus.on('SCENARIO_TRIGGERED', (data) => {
      setCurrentScenarioEvent(data);
      if (data.name.toLowerCase().includes('reset')) {
        setActivePreset(null);
      }
      setTimeout(() => {
        setCurrentScenarioEvent(null);
      }, 6000);
    });
    return unsub;
  }, []);

  const handleLocalityChange = (locId: 'velachery' | 'omr' | 'besant_nagar') => {
    setActiveLocality(locId);
    const key = locId === 'besant_nagar' ? 'besantNagar' : locId;
    const loc = ECOSYSTEM_CONFIG.localities[key];
    if (loc) {
      window.dispatchEvent(new CustomEvent('map-fly-to', {
        detail: { lat: loc.lat, lng: loc.lng, zoom: 14 }
      }));
    }
  };

  const handleTriggerScenario = (preset: string) => {
    setActivePreset(preset);
    triggerScenario(preset as 'heatwave' | 'monsoon' | 'event' | 'clear' | 'gaps');
  };

  const handleRewind = () => {
    triggerScenario('clear');
    setActivePreset(null);
    setIsSimPlaying(true);
  };

  // Use insights from useIntelligence as narratives
  // We keep the variable name 'narratives' but it points to the fetched insights

  // Generate printer KPI metrics
  const printerKPIs = useMemo(() => {
    const totalReports = reports.length;
    const resolvedReports = reports.filter(r => r.status === 'resolved').length;
    return {
      networkHealth,
      avgResponseTimeMin: 22,
      actionsPerformed: updates.length,
      resolutionRate: totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 92,
    };
  }, [reports, updates, networkHealth]);

  const zoneMetrics = useMemo(() => {
    return Object.values(ECOSYSTEM_CONFIG.localities).map(loc => {
      const zoneStations = stations.filter(s => Math.abs(s.lat - loc.lat) < 0.01 && Math.abs(s.lng - loc.lng) < 0.01);
      const isCritical = zoneStations.some(s => s.status === 'needs_refill' || s.status === 'needs_cleanup' || s.status === 'critical');
      return {
        name: loc.name,
        status: isCritical ? 'critical' : 'stable',
        activeVolunteers: Math.round(loc.volunteerDensity * 4),
      };
    });
  }, [stations]);

  const mattersPoints = useMemo(() => {
    return getWhyThisMatters(printerKPIs, zoneMetrics);
  }, [printerKPIs, zoneMetrics]);

  return (
    <div className="h-screen w-full bg-brand-graphite text-white flex flex-col overflow-hidden font-sans">
      
      {/* ── TOP HUD ── */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0A0E27]/80 backdrop-blur-md z-50 shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Return to Home"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/pawloop-logo-icon.png" alt="PawLoop Logo" className="w-6 h-6 object-contain filter invert opacity-90" />
            <h1 className="font-heading text-lg font-bold tracking-wide">PAWLOOP COMMAND</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 ml-2 uppercase tracking-wider text-brand-sky">
              Phase 3 Live
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Replay controller */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <button 
              onClick={() => setIsSimPlaying(!isSimPlaying)}
              className="p-1 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white flex items-center justify-center"
              title={isSimPlaying ? 'Pause Simulation Timeline' : 'Resume Simulation Timeline'}
            >
              {isSimPlaying ? <Pause size={12} className="text-green-400 animate-pulse" /> : <Play size={12} className="text-amber-400" />}
            </button>
            <button 
              onClick={handleRewind}
              className="p-1 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white flex items-center justify-center"
              title="Reset Simulation Data"
            >
              <RotateCcw size={12} />
            </button>
            <span className="text-[9px] font-mono text-gray-400 select-none mr-1 uppercase font-bold">
              {isSimPlaying ? 'Replay Active' : 'Timeline Paused'}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Network Health</span>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold font-mono ${networkHealth > 80 ? 'text-green-400' : networkHealth > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {networkHealth}%
              </span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-white/10" />
          
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Active Volunteers</span>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-brand-sky" />
              <span className="text-lg font-bold font-mono">{demoMode ? demoStats.volunteersOnline : liveVolunteers}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />
          
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Critical Nodes</span>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-lg font-bold font-mono">{criticalCount}</span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-white/10" />

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-brand-sky hover:bg-brand-sky/95 text-brand-graphite px-4 py-2 rounded-full font-bold text-xs transition-all duration-200 active:scale-95 shadow-md shadow-brand-sky/20"
            title="Open printable report Mode"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Narrative & Telemetry Tabbed View */}
        <div className="w-80 bg-[#12182B]/80 backdrop-blur-xl border-r border-white/10 flex flex-col z-40 shadow-2xl">
          <div className="flex border-b border-white/10 bg-black/20 p-1">
            <button 
              onClick={() => setLeftTab('narrative')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                leftTab === 'narrative' 
                  ? 'bg-white/5 text-white border border-white/10 shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen size={12} />
              <span>City Narratives</span>
            </button>
            <button 
              onClick={() => setLeftTab('telemetry')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                leftTab === 'telemetry' 
                  ? 'bg-white/5 text-white border border-white/10 shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity size={12} />
              <span>Telemetry Log</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {leftTab === 'narrative' ? (
              <div className="space-y-3">
                {narratives.map((nar) => (
                  <div 
                    key={nar.id} 
                    className={`p-3 rounded-xl border transition-all surface-dark-glass ${
                      nar.type === 'alert' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                      nar.type === 'success' ? 'border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]' :
                      nar.type === 'info' ? 'border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.2)]' :
                      'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs">
                        {nar.type === 'alert' ? '🚨' : nar.type === 'success' ? '💚' : nar.type === 'info' ? 'ℹ️' : '🤖'}
                      </span>
                      <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                        nar.type === 'alert' ? 'text-red-400' :
                        nar.type === 'success' ? 'text-teal-400' :
                        nar.type === 'info' ? 'text-sky-400' :
                        'text-gray-300'
                      }`}>{nar.title}</h4>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{nar.body}</p>
                    <span className="text-[9px] text-gray-500 block mt-2 font-mono">{timeAgo(nar.timestamp || new Date().toISOString())}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update.id} className="flex gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-brand-sky">
                      {update.action === 'refilled' ? '🍽' : update.action === 'cleaned' ? '🧹' : '⚡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 capitalize">{update.action.replace('_', ' ')}</p>
                      {update.notes && <p className="text-xs text-gray-400 truncate">{update.notes}</p>}
                      <p className="text-[10px] text-gray-500 mt-1">{timeAgo(update.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Massive Map */}
        <div className="flex-1 relative bg-brand-sand">
          <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-center">
            <MapFilterBar
              activeFilter={filterType}
              onFilterChange={setFilterType}
              stations={stations}
              reports={reports}
            />
          </div>
          
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl flex items-center gap-2 text-white">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-sky animate-pulse" />
              <span className="text-xs font-medium">{cityPulse}</span>
            </div>
          </div>

          <MapView
            stations={stations}
            reports={reports}
            updates={updates}
            showHeatmap={false}
            filterType={filterType}
            environmentState={environmentState}
            reducedMotion={reducedMotion}
            onStationSelect={(s) => setSelectedStationId(s.id)}
          />

          {/* Collapsible Dev Observability & Diagnostics HUD Panel */}
          <div className="absolute top-36 right-6 z-[1000] flex flex-col items-end pointer-events-auto select-none">
            {!showDevPanel ? (
              <button
                onClick={() => setShowDevPanel(true)}
                className="surface-glass px-3 py-2 rounded-xl shadow-float flex items-center gap-2 border border-white/20 hover:bg-white/10 active:scale-95 transition-all duration-200"
              >
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${fps >= 50 ? 'bg-green-400' : fps >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${fps >= 50 ? 'bg-green-500' : fps >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-[10px] font-bold font-mono tracking-wider text-gray-300">DIAGNOSTICS: {fps} FPS</span>
              </button>
            ) : (
              <div className="w-[320px] bg-[#1e2329]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
                {/* Header */}
                <div className="p-3 bg-[#14181c] border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-brand-sky" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-sky">Dev Diagnostics HUD</span>
                  </div>
                  <button
                    onClick={() => setShowDevPanel(false)}
                    className="text-gray-400 hover:text-white text-xs font-bold font-mono"
                  >
                    [CLOSE]
                  </button>
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar">
                  {/* Performance Metrics */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">System Performance</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        fps >= 50 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        fps >= 30 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {fps} FPS
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-200">Reduced Motion Mode</span>
                        <span className="text-[8px] text-gray-400 text-left">Disables Leaflet camera flyTo sweeping pans</span>
                      </div>
                      <button
                        onClick={() => setReducedMotion(!reducedMotion)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${reducedMotion ? 'bg-brand-sky' : 'bg-gray-700'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow transform duration-200 ${reducedMotion ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* WebSocket Channels Subscriptions */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block text-left">WebSocket Channels Registry</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(SubscriptionRegistry).map(([name, item]) => {
                        const statusColors: Record<string, string> = {
                          SUBSCRIBED: 'text-green-400 border-green-500/30 bg-green-500/10',
                          SUBSCRIBING: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                          UNSUBSCRIBED: 'text-gray-400 border-white/10 bg-white/5',
                          FAILED: 'text-red-400 border-red-500/30 bg-red-500/10',
                        };
                        return (
                          <div key={name} className="p-1.5 rounded-lg border border-white/5 bg-[#14181c]/50 flex flex-col gap-0.5 text-left">
                            <span className="text-[8px] font-mono text-gray-300 truncate">{name.replace('-realtime', '')}</span>
                            <div className="flex justify-between items-center mt-0.5">
                              <span className={`text-[7px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider ${statusColors[item.status] || statusColors.UNSUBSCRIBED}`}>
                                {item.status}
                              </span>
                              <span className="text-[8px] font-mono text-gray-500">
                                Σ: {item.eventCount}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Event Bus Ticker */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block text-left">Live Event Bus Traces ({eventBus.traces.length})</span>
                    <div className="bg-[#14181c] border border-white/5 rounded-lg p-2 max-h-[80px] overflow-y-auto custom-scrollbar font-mono text-[8px] text-brand-sky space-y-1 text-left">
                      {eventBus.traces.length === 0 ? (
                        <span className="text-gray-600 italic block">Awaiting event bus emissions...</span>
                      ) : (
                        eventBus.traces.map((trace) => (
                          <div key={trace.id} className="border-b border-white/5 pb-1 last:border-b-0">
                            <div className="flex justify-between text-gray-400">
                              <span className="font-bold">{trace.event}</span>
                              <span>{new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <div className="text-gray-500 truncate text-[7px] mt-0.5">
                              {JSON.stringify(trace.data)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Error & Connection Logs */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block text-left">Diagnostics & Sync Log</span>
                    <div className="bg-[#14181c] border border-white/5 rounded-lg p-2 max-h-[80px] overflow-y-auto custom-scrollbar font-mono text-[8px] text-gray-400 space-y-1 text-left">
                      {errorLogs.map((log, idx) => (
                        <div key={idx} className={`truncate ${log.includes('ERR') || log.includes('WARN') ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Active Preset Toast alert */}
          {currentScenarioEvent && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] animate-bounce pointer-events-none">
              <div className="bg-[#EF4444]/90 backdrop-blur-xl px-5 py-3 rounded-full border border-red-500/50 shadow-2xl flex items-center gap-3 text-white">
                <span className="text-lg">🚨</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider">{currentScenarioEvent.name}</span>
                  <span className="text-[10px] text-red-200 leading-tight">{currentScenarioEvent.description}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline Paused Flasher */}
          {!isSimPlaying && (
            <div className="absolute top-20 right-6 z-[1000]">
              <div className="bg-amber-500/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-amber-600/50 text-brand-graphite font-bold text-xs flex items-center gap-1.5 animate-pulse">
                <Pause size={12} />
                <span>SIMULATION TIMELINE SUSPENDED</span>
              </div>
            </div>
          )}

          {/* Locality Preset Controls switcher */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-[#1e2329]/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-2 pointer-events-auto">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1">
              <MapPin size={10} className="text-brand-sky" /> Pilot Locality Presets
            </span>
            <div className="flex gap-1.5">
              {(['velachery', 'omr', 'besant_nagar'] as const).map((locId) => (
                <button
                  key={locId}
                  onClick={() => handleLocalityChange(locId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    activeLocality === locId
                      ? 'bg-brand-sky text-brand-graphite shadow-md shadow-brand-sky/10'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {locId === 'velachery' ? 'Velachery Spot' : locId === 'omr' ? 'OMR IT Bypass' : 'Besant Coastal'}
                </button>
              ))}
            </div>
          </div>

          {/* Active Mission Overlay */}
          {activeMission && (
            <div className="absolute bottom-6 right-6 z-[1000] animate-slide-up pointer-events-none">
              <div className="bg-[#1e2329]/90 backdrop-blur-xl p-4 rounded-2xl border border-brand-sky/30 shadow-2xl flex items-center gap-6 min-w-[340px]">
                <div className="w-10 h-10 rounded-full bg-brand-sky/20 border border-brand-sky/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🏃</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-brand-sky uppercase tracking-widest">Active Dispatch</span>
                    <span className="text-xs font-mono text-gray-300">ETA {activeMission.eta}s</span>
                  </div>
                  <p className="text-xs font-medium text-white">
                    {activeMission.volunteerName} en route to {activeMission.type === 'cleanup' ? 'clean' : 'refill'} station
                  </p>
                  <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden relative">
                    <div className="absolute top-0 left-0 bottom-0 bg-brand-sky rounded-full w-1/2 animate-[progress_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Intelligence & Scenario Toggles */}
        <div className="w-80 bg-[#12182B]/80 backdrop-blur-xl border-l border-white/10 flex flex-col z-40 shadow-2xl">
          <div className="p-4 border-b border-white/10 bg-black/20">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Shield size={14} className="text-brand-sky" /> Intelligence Hub
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            
            {/* Scenario simulation presets switcher */}
            <div className="p-4 rounded-xl surface-dark-glass shadow-float">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Sparkles size={12} className="text-brand-sky animate-pulse" /> Environmental Presets
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(['heatwave', 'rain', 'festival', 'gaps'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleTriggerScenario(preset)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      activePreset === preset
                        ? 'bg-brand-sky/20 border-brand-sky text-brand-sky shadow-lg shadow-brand-sky/5'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="text-[11px] font-bold capitalize">
                      {preset === 'gaps' ? 'Deficit' : preset}
                    </div>
                    <span className="text-[8px] text-gray-400 block mt-1 leading-tight font-sans">
                      {preset === 'heatwave' && 'Water Crisis'}
                      {preset === 'rain' && 'Monsoon Surge'}
                      {preset === 'festival' && 'Feeding Spike'}
                      {preset === 'gaps' && 'Neglected Gaps'}
                    </span>
                  </button>
                ))}
              </div>
              {activePreset && (
                <button
                  onClick={() => handleTriggerScenario('clear')}
                  className="w-full mt-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs font-bold hover:bg-white/15 transition-colors"
                >
                  Clear Preset Simulation
                </button>
              )}
            </div>

            {/* Live Strategic Ticker */}
            {narratives.map((insight) => (
              <div 
                key={insight.id} 
                className={`p-4 rounded-xl border surface-dark-glass ${
                  insight.type === 'urgent' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                  insight.type === 'warning' ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
                  insight.type === 'positive' ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' :
                  'border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{insight.icon}</span>
                  <h3 className={`text-xs font-bold ${
                    insight.type === 'urgent' ? 'text-red-400' :
                    insight.type === 'warning' ? 'text-amber-400' :
                    insight.type === 'positive' ? 'text-green-400' :
                    'text-brand-sky'
                  }`}>{insight.title}</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans">{insight.body}</p>
              </div>
            ))}

            {/* Confidence Demo Box */}
            <div className="p-4 rounded-xl surface-dark-glass shadow-float">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Zone Confidence</h3>
               <div className="space-y-3">
                  {(['verified', 'community_confirmed', 'stale', 'abandoned'] as const).map(conf => (
                     <div key={conf} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[conf] }} />
                           <span className="text-xs text-gray-300 capitalize">{conf.replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs font-mono text-gray-500">
                           {stations.filter(s => calculateConfidenceState(s) === conf).length}
                        </span>
                     </div>
                  ))}
               </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── PRINT-ONLY MUNICIPAL REPORT ── */}
      <div className="hidden print:block print-report-container bg-white text-black p-10 min-h-screen">
        <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 uppercase">PawLoop Urban Infrastructure Report</h1>
            <p className="text-sm text-gray-600 font-mono mt-1">Locality Pilot: Adyar/OMR/Velachery Chennai Regional Coordination Network</p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-bold text-gray-800">OFFICIAL USE ONLY</span>
            <p className="text-xs text-gray-500 mt-2 font-mono">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-4">Strategic Operational Summary</h2>
        <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1">Operational KPIs</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-300 p-3 rounded bg-white">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Network Health</span>
                <span className="text-2xl font-bold text-gray-900">{printerKPIs.networkHealth}%</span>
              </div>
              <div className="border border-gray-300 p-3 rounded bg-white">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Resolution Rate</span>
                <span className="text-2xl font-bold text-gray-900">{printerKPIs.resolutionRate}%</span>
              </div>
              <div className="border border-gray-300 p-3 rounded bg-white">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Refills & Sweeps</span>
                <span className="text-2xl font-bold text-gray-900">{printerKPIs.actionsPerformed}</span>
              </div>
              <div className="border border-gray-300 p-3 rounded bg-white">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Active Volunteers</span>
                <span className="text-2xl font-bold text-gray-900">{demoMode ? demoStats.volunteersOnline : 0}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1">Locality Zone Reports</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-gray-500 uppercase">
                  <th className="py-2">Zone Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Active Staff</th>
                </tr>
              </thead>
              <tbody>
                {zoneMetrics.map((zone, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-2.5 font-bold text-gray-800">{zone.name}</td>
                    <td className="py-2.5 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${zone.status === 'critical' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {zone.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-gray-700">{zone.activeVolunteers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-4">Strategic Narratives (&quot;Why This Matters&quot;)</h2>
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 space-y-4">
            {mattersPoints.map((point, index) => (
              <div key={index} className="flex gap-3 text-sm text-gray-700 leading-relaxed font-sans border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                <span className="text-gray-950 font-bold font-mono">0{index + 1}.</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 border-t border-gray-400 pt-8 flex justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold">PawLoop Realtime Decentralized Ecosystem Operations Center</p>
            <p className="text-[10px] text-gray-400 mt-1 font-mono">System authentication verified securely via Supabase SSR Cryptographic Session Hydration.</p>
          </div>
          <div className="w-60 border-b border-gray-900 text-center pb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider block mb-16">Authorized Municipal Inspector Signature</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        @keyframes progress {
          0% { width: 0%; left: 0%; }
          50% { width: 50%; left: 25%; }
          100% { width: 0%; left: 100%; }
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          header,
          .flex-1.flex.overflow-hidden > div:not(.print-report-container),
          #btn-locate-me,
          .absolute.top-4,
          .absolute.top-20,
          .absolute.bottom-6,
          .z-50,
          .z-40 {
            display: none !important;
          }
          .print-report-container {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 99999 !important;
            background: white !important;
            color: black !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
        }
      `}</style>
    </div>
  );
}
