'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Activity,
  Heart,
  Trophy,
  Zap,
  Shield,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { useRealtime } from '@/lib/use-realtime';
import { useDemoContext } from '@/lib/demo-context';
import { useAnalytics } from '@/lib/use-analytics';
import BottomNav from '@/components/layout/bottom-nav';

export default function AnalyticsPage() {
  const router = useRouter();
  const { demoMode } = useDemoContext();
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(7);

  // Fetch all datasets from our real-time synchronization store
  const { stations, reports, updates, tasks, analyticsEvents, loading } = useRealtime(demoMode);

  // Compile calculations through the analytics hook
  const { kpis, zoneMetrics, leaderboard, timelineData } = useAnalytics(
    stations,
    reports,
    updates,
    tasks,
    analyticsEvents || [],
    timeRange,
    demoMode
  );

  // SVG Chart Dimensions
  const chartWidth = 500;
  const chartHeight = 150;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 20;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Max value calculations for chart y-scaling
  const maxActivityValue = Math.max(
    5,
    ...timelineData.map((d) => Math.max(d.refills + d.cleanups, d.emergencies))
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-[120px] flex flex-col font-sans">
      
      {/* ─── HEADER SECTION ───────────────────────────────────── */}
      <header className="px-4 pt-10 pb-4 bg-[var(--bg-main)] sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[var(--border-light)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <ArrowLeft size={20} className="text-[var(--text-body)]" />
            </button>
            <div>
              <h1 className="font-heading text-xl font-bold text-[var(--text-heading)] leading-tight">
                Pilot Analytics
              </h1>
              <p className="text-[10px] text-[var(--text-body)] font-medium uppercase tracking-wider mt-0.5">
                Chennai Operations Dashboard
              </p>
            </div>
          </div>

          {/* Mode Badge Indicator */}
          <div className={`
            px-3 py-1 rounded-full text-[9px] font-extrabold flex items-center gap-1.5 shadow-sm border
            ${demoMode
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-green-50 border-green-200 text-green-700'
            }
          `}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${demoMode ? 'bg-[#3B82F6]' : 'bg-[#22C55E]'}`} />
            <span>{demoMode ? 'DEMO SIMULATION' : 'LIVE DATABASE'}</span>
          </div>
        </div>
      </header>

      {/* ─── TIME RANGE FILTER CAPSULE ────────────────────────── */}
      <div className="px-4 py-2 flex justify-between items-center">
        <div className="bg-white border border-[var(--border-light)] rounded-full p-1 flex items-center shadow-sm">
          <button
            onClick={() => setTimeRange(7)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${timeRange === 7 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-body)] hover:text-[var(--accent-primary)]'}`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange(30)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${timeRange === 30 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-body)] hover:text-[var(--accent-primary)]'}`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange(90)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${timeRange === 90 ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-body)] hover:text-[var(--accent-primary)]'}`}
          >
            90 Days
          </button>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-[var(--text-body)] font-semibold bg-white border border-[var(--border-light)] shadow-sm px-3 py-1.5 rounded-full">
          <Calendar size={12} className="text-gray-500" />
          <span>Active Pilot Timeline</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-3 border-brand-forest border-t-transparent animate-spin" />
        </div>
      ) : (
        <main className="px-4 mt-3 space-y-5 flex-1">
          
          {/* ─── KPI GRID ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3.5">
            
            {/* KPI 1: Network Health */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 relative overflow-hidden animate-slide-up flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-[var(--text-body)] font-bold uppercase tracking-wider">Network Health</span>
                <Activity size={16} className={kpis.networkHealth >= 75 ? 'text-[#22C55E]' : 'text-red-500'} />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-heading font-extrabold text-[var(--text-heading)]">{kpis.networkHealth}%</span>
                <span className="text-[10px] text-[#22C55E] font-bold flex items-center">
                  <TrendingUp size={10} className="mr-0.5" /> Optimal
                </span>
              </div>
              <div className="mt-2 text-[9px] text-[var(--text-body)] font-medium">
                Average hygiene & volume levels across active stations.
              </div>
            </div>

            {/* KPI 2: Active Stations */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 relative overflow-hidden animate-slide-up flex flex-col justify-between" style={{ animationDelay: '50ms' }}>
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-[var(--text-body)] font-bold uppercase tracking-wider">Active Stations</span>
                <Shield size={16} className="text-[#3B82F6] opacity-80" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-heading font-extrabold text-[var(--text-heading)]">{kpis.activeStations}</span>
                <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">Pilot Spots</span>
              </div>
              <div className="mt-2 text-[9px] text-[var(--text-body)] font-medium">
                Sustained feeding, shelter & water bowls mapped in Chennai.
              </div>
            </div>

            {/* KPI 3: Emergency Resolution */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 relative overflow-hidden animate-slide-up flex flex-col justify-between" style={{ animationDelay: '100ms' }}>
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-[var(--text-body)] font-bold uppercase tracking-wider">Rescue Rate</span>
                <Heart size={16} className="text-red-500" />
              </div>
              <div className="mt-2.5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-heading font-extrabold text-[var(--text-heading)]">{kpis.resolutionRate}%</span>
                  <span className="text-[9px] text-red-600 font-bold">
                    {kpis.openEmergencies} active
                  </span>
                </div>
                <span className="text-[9px] text-[var(--text-body)] font-semibold mt-1">
                  Avg Res: {kpis.avgResponseTimeMin} mins
                </span>
              </div>
            </div>

            {/* KPI 4: Actions Performed */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 relative overflow-hidden animate-slide-up flex flex-col justify-between" style={{ animationDelay: '150ms' }}>
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-[var(--text-body)] font-bold uppercase tracking-wider">Refills & Cleans</span>
                <Zap size={16} className="text-yellow-500" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-heading font-extrabold text-[var(--text-heading)]">{kpis.actionsPerformed}</span>
                <span className="text-[9px] bg-yellow-50 text-yellow-700 font-bold px-1.5 py-0.5 rounded">Tasks</span>
              </div>
              <div className="mt-2 text-[9px] text-[var(--text-body)] font-medium">
                Total recorded water refills & sanitizations completed.
              </div>
            </div>

          </div>

          {/* ─── CHARTS PANEL ────────────────────────────────────── */}
          <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-5 space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div>
              <h3 className="font-heading font-bold text-[var(--text-heading)] text-sm">Volunteer Activity & Engagement</h3>
              <p className="text-[10px] text-[var(--text-body)]">Number of daily refills/cleanups vs emergency incident reports</p>
            </div>

            {/* SVG Activity Stacked Graph */}
            <div className="w-full bg-[var(--bg-subtle)] rounded-2xl p-2.5 border border-[var(--border-light)]">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
                <defs>
                  <linearGradient id="gradient-refill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="gradient-cleanup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines */}
                {[0, 0.5, 1].map((val, idx) => {
                  const y = paddingTop + graphHeight * val;
                  const label = Math.round(maxActivityValue * (1 - val));
                  return (
                    <g key={idx} className="opacity-40">
                      <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#9CA3AF" strokeWidth="0.5" strokeDasharray="4" />
                      <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="fill-gray-500 font-semibold text-[8px]">{label}</text>
                    </g>
                  );
                })}

                {/* X-Axis Dates & Bars */}
                {timelineData.map((d, idx) => {
                  const itemWidth = graphWidth / timelineData.length;
                  const x = paddingLeft + idx * itemWidth + itemWidth / 2;

                  // Bar heights
                  const totalTasks = d.refills + d.cleanups;
                  const tasksHeight = (totalTasks / maxActivityValue) * graphHeight;
                  const refillsHeight = (d.refills / maxActivityValue) * graphHeight;
                  
                  const yTasks = paddingTop + graphHeight - tasksHeight;
                  const yRefills = paddingTop + graphHeight - refillsHeight;

                  // Emergency Line coordinate
                  const emergencyHeight = (d.emergencies / maxActivityValue) * graphHeight;
                  const yEmergency = paddingTop + graphHeight - emergencyHeight;

                  return (
                    <g key={idx}>
                      {/* Stacked Bars */}
                      <rect
                        x={x - itemWidth * 0.25}
                        y={yTasks}
                        width={itemWidth * 0.5}
                        height={tasksHeight}
                        rx="2"
                        className="fill-[#3B82F6]/60 hover:fill-[#3B82F6] transition-colors cursor-pointer"
                      />
                      <rect
                        x={x - itemWidth * 0.25}
                        y={yRefills}
                        width={itemWidth * 0.5}
                        height={refillsHeight}
                        rx="2"
                        className="fill-[#22C55E]/70 hover:fill-[#22C55E] transition-colors cursor-pointer"
                      />

                      {/* Line Anchor Points */}
                      <circle cx={x} cy={yEmergency} r="2.5" className="fill-red-500 stroke-white stroke-[0.5]" />

                      {/* X Label */}
                      {idx % (timeRange === 90 ? 10 : timeRange === 30 ? 4 : 1) === 0 && (
                        <text
                          x={x}
                          y={chartHeight - 4}
                          textAnchor="middle"
                          className="fill-gray-500 font-semibold text-[7px]"
                        >
                          {d.date}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Emergency Incident Polyline */}
                <path
                  d={timelineData
                    .map((d, idx) => {
                      const itemWidth = graphWidth / timelineData.length;
                      const x = paddingLeft + idx * itemWidth + itemWidth / 2;
                      const emergencyHeight = (d.emergencies / maxActivityValue) * graphHeight;
                      const y = paddingTop + graphHeight - emergencyHeight;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="1.5"
                  className="opacity-70"
                />
              </svg>
            </div>

            {/* Legend indicators */}
            <div className="flex justify-center gap-5 text-[9px] font-semibold text-[var(--text-body)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#22C55E]" />
                <span>Refills</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#3B82F6]" />
                <span>Cleanups</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-red-500 inline-block" />
                <span>Emergencies</span>
              </div>
            </div>
          </div>

          {/* ─── TWO COLUMNS DETAIL SECTION ──────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Column 1: Chennai Pilot Zones */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 space-y-3">
              <div>
                <h3 className="font-heading font-bold text-[var(--text-heading)] text-sm">Chennai Neighborhood Standings</h3>
                <p className="text-[10px] text-[var(--text-body)]">Health distribution sorted by lowest first</p>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {zoneMetrics.map((z, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-subtle)] flex items-center justify-between hover:bg-white transition-colors shadow-sm"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-heading)]">{z.name}</h4>
                      <span className="text-[9px] text-[var(--text-body)] font-medium">
                        {z.stationCount} mapped stations • {z.criticalCount} warning
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Health number */}
                      <div className="text-right">
                        <div className="text-xs font-heading font-bold text-[var(--text-heading)]">{z.healthScore}%</div>
                        <span className="text-[8px] text-[var(--text-body)] font-semibold tracking-wide uppercase">Health</span>
                      </div>

                      {/* Health Indicator Badge */}
                      <span className={`
                        text-[8px] font-extrabold px-2 py-0.5 rounded-full shrink-0
                        ${z.status === 'optimal' ? 'bg-green-50 text-green-700 border border-green-200' :
                          z.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                        }
                      `}>
                        {z.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Leaderboard & Engagement */}
            <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 space-y-3">
              <div>
                <h3 className="font-heading font-bold text-[var(--text-heading)] text-sm">Volunteer Leaderboard</h3>
                <p className="text-[10px] text-[var(--text-body)]">Chennai pilot contribution credits</p>
              </div>

              <div className="space-y-2">
                {leaderboard.map((v, idx) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)] shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Rank Trophy */}
                      <div className={`
                        w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border
                        ${idx === 0 ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                          idx === 1 ? 'bg-slate-100 text-slate-500 border-slate-200' :
                          idx === 2 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-white text-gray-500 border-[var(--border-light)]'
                        }
                      `}>
                        {idx + 1}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-heading)] flex items-center gap-1">
                          {v.name}
                          {idx === 0 && <Trophy size={10} className="text-yellow-500" />}
                        </h4>
                        <span className="text-[9px] text-[var(--text-body)] font-semibold">{v.role}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-heading font-bold text-[#22C55E]">{v.actionsCount}</span>
                      <span className="text-[8px] text-[var(--text-body)] font-bold block">Ops Completed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ─── SYSTEM INTELLIGENCE INSIGHTS ───────────────────────── */}
          <div className="bg-white border border-[var(--border-light)] rounded-2xl shadow-sm p-4 space-y-2.5 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-[var(--accent-primary)] animate-bounce" />
              <h3 className="font-heading font-bold text-[var(--text-heading)] text-sm">System Intelligence</h3>
            </div>

            <div className="space-y-2 text-[10px] font-medium text-[var(--text-body)] leading-relaxed">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex gap-2">
                <span className="shrink-0 text-blue-600">💡</span>
                <p>
                  <strong className="text-[var(--text-heading)] font-bold">Water Depletion Speed: </strong>
                  Refill decay is running at <strong className="text-[var(--accent-primary)]">1.8x</strong> above baseline in <strong className="text-[var(--text-heading)]">Pallikaranai Marsh Edge</strong> due to high afternoon temperatures (38°C). Volunteer notifications have been dispatched.
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-2xl border border-green-200 flex gap-2">
                <span className="shrink-0 text-green-600">💡</span>
                <p>
                  <strong className="text-[var(--text-heading)] font-bold">Zone Coverage Success: </strong>
                  <strong className="text-green-700">Besant Nagar</strong> and <strong className="text-[var(--text-heading)]">Adyar River Walkway</strong> have crossed 92% health scoring. Proactive routing is working, volunteer engagement is stable!
                </p>
              </div>
            </div>
          </div>

        </main>
      )}

      {/* Persistent App-wide Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
