'use client';

import { useMemo } from 'react';
import type { Station, AnimalReport, StationUpdate, Task } from './types';
import { calculateHealthScore } from './types';

export interface AnalyticsKPIs {
  networkHealth: number;          // 0-100
  activeStations: number;
  openEmergencies: number;
  resolvedEmergencies: number;
  resolutionRate: number;         // percentage
  avgResponseTimeMin: number;
  actionsPerformed: number;       // total refills/cleanups
}

export interface ZoneMetric {
  name: string;
  stationCount: number;
  criticalCount: number;
  healthScore: number;            // average health
  status: 'optimal' | 'warning' | 'critical';
}

export interface VolunteerLeader {
  id: string;
  name: string;
  avatar: string | null;
  actionsCount: number;
  role: string;
}

export interface TimelineDataPoint {
  date: string;
  refills: number;
  cleanups: number;
  emergencies: number;
  health: number;
}

export function useAnalytics(
  stations: Station[],
  reports: AnimalReport[],
  updates: StationUpdate[],
  tasks: Task[],
  analyticsEvents: Record<string, unknown>[] = [],
  timeRangeDays: number = 7,
  demoMode: boolean = false
) {
  return useMemo(() => {
    // ─── 1. CORE OPERATIONS KPIS ─────────────────────────────
    
    // Live compute helper
    const activeStationsList = stations.filter(s => s.status !== 'archived' && s.status !== 'inactive');
    const activeStationsCount = activeStationsList.length;
    
    const openEmergencies = reports.filter(r => r.status === 'open' || r.status === 'in_progress').length;
    const resolvedEmergencies = reports.filter(r => r.status === 'resolved').length;
    const totalEmergencies = reports.length;
    const resolutionRate = totalEmergencies > 0 
      ? Math.round((resolvedEmergencies / totalEmergencies) * 100) 
      : 100;

    // Average Response Time
    let avgResponseTimeMin = 0;
    if (!demoMode) {
      const resolvedWithTimes = reports.filter(r => r.status === 'resolved' && r.resolved_at && r.created_at);
      if (resolvedWithTimes.length > 0) {
        const totalMin = resolvedWithTimes.reduce((acc, r) => {
          const diffMs = new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime();
          return acc + diffMs / (1000 * 60);
        }, 0);
        avgResponseTimeMin = Math.round(totalMin / resolvedWithTimes.length);
      }
    } else {
      // Demo mode dynamic values
      avgResponseTimeMin = 18 + Math.floor((100 - resolutionRate) / 2);
    }

    // Network Health
    let networkHealth = demoMode ? 88 : 0;
    if (activeStationsCount > 0) {
      const totalHealth = activeStationsList.reduce((acc, s) => {
        const { percentage } = calculateHealthScore(s);
        return acc + percentage;
      }, 0);
      networkHealth = Math.round(totalHealth / activeStationsCount);
    }

    let actionsPerformed = updates.filter(
      u => u.action === 'refilled' || u.action === 'cleaned' || u.action === 'completed_task'
    ).length;

    if (!demoMode && analyticsEvents && analyticsEvents.length > 0) {
      const liveEventsCount = analyticsEvents.filter(
        e => e.event_type === 'task_completed' || e.event_type === 'station_update'
      ).length;
      actionsPerformed = Math.max(actionsPerformed, liveEventsCount);
    }

    const kpis: AnalyticsKPIs = {
      networkHealth: Math.max(10, Math.min(100, networkHealth)),
      activeStations: activeStationsCount,
      openEmergencies,
      resolvedEmergencies,
      resolutionRate,
      avgResponseTimeMin,
      actionsPerformed: actionsPerformed || (demoMode ? 142 : 0),
    };

    // ─── 2. NEIGHBORHOOD / ZONE METRICS ──────────────────────
    const zones: ZoneMetric[] = [
      { name: 'Velachery', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Adyar', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Besant Nagar', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Guindy', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Taramani', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Pallikaranai', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Thiruvanmiyur', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
      { name: 'Anna Nagar', stationCount: 0, criticalCount: 0, healthScore: 0, status: 'optimal' },
    ];

    // Populate zone metrics from current stations list
    stations.forEach((s) => {
      if (s.status === 'archived') return;

      const { percentage } = calculateHealthScore(s);
      const notesLower = (s.notes || '').toLowerCase();
      
      // Classify neighborhood
      let matchingZone = zones.find(z => notesLower.includes(z.name.toLowerCase()));
      if (!matchingZone) {
        // Simple geo box matching as fallback
        if (s.lat > 12.99 && s.lng < 80.22) matchingZone = zones[3]; // Guindy
        else if (s.lat < 12.97 && s.lng > 80.21) matchingZone = zones[5]; // Pallikaranai
        else if (s.lat < 12.98 && s.lng > 80.23) matchingZone = zones[6]; // Thiruvanmiyur
        else if (s.lat > 13.01) matchingZone = zones[7]; // Anna Nagar
        else if (s.lng < 80.215) matchingZone = zones[0]; // Velachery
        else if (s.lng > 80.25) matchingZone = zones[2]; // Besant Nagar
        else matchingZone = zones[1]; // Adyar
      }

      if (matchingZone) {
        matchingZone.stationCount += 1;
        matchingZone.healthScore += percentage;
        if (s.status === 'needs_refill' || s.status === 'needs_cleanup' || percentage < 45) {
          matchingZone.criticalCount += 1;
        }
      }
    });

    // Finalize zone computations
    const zoneMetrics: ZoneMetric[] = zones.map((z) => {
      const avgHealth = z.stationCount > 0 ? Math.round(z.healthScore / z.stationCount) : (demoMode ? 75 : 0);
      let status: 'optimal' | 'warning' | 'critical' = 'optimal';
      
      if (z.criticalCount > 1 || avgHealth < 50) status = 'critical';
      else if (z.criticalCount > 0 || avgHealth < 75) status = 'warning';

      return {
        ...z,
        healthScore: avgHealth,
        status,
        // Mock station count if in demo mode and empty
        stationCount: z.stationCount || (demoMode ? (z.name.length % 3) + 1 : 0),
      };
    }).sort((a, b) => a.healthScore - b.healthScore); // Sort by lowest health first

    // ─── 3. VOLUNTEER LEADERBOARD ────────────────────────────
    
    // Static demo leaderboard
    const DEMO_LEADERS: VolunteerLeader[] = [
      { id: 'vl-1', name: 'Arjun', avatar: null, actionsCount: 42, role: 'Lead Refiller' },
      { id: 'vl-2', name: 'Priya', avatar: null, actionsCount: 38, role: 'Emergency Responder' },
      { id: 'vl-3', name: 'Karthik', avatar: null, actionsCount: 29, role: 'Active Ranger' },
      { id: 'vl-4', name: 'Divya', avatar: null, actionsCount: 21, role: 'Community Supporter' },
      { id: 'vl-5', name: 'Suresh', avatar: null, actionsCount: 15, role: 'Local Volunteer' },
    ];

    let leaderboard: VolunteerLeader[] = [];
    if (demoMode) {
      leaderboard = DEMO_LEADERS;
    } else {
      // Compile from updates
      const volunteerStats: Record<string, { name: string; count: number }> = {};
      
      updates.forEach((u) => {
        const name = u.profile?.name || (u.notes ? u.notes.split(':')[0] : 'Community Member');
        if (name && name.length < 25 && name !== 'System' && !name.includes(' ') && name !== 'Community') {
          if (!volunteerStats[name]) {
            volunteerStats[name] = { name, count: 0 };
          }
          volunteerStats[name].count += 1;
        }
      });

      leaderboard = Object.entries(volunteerStats)
        .map(([id, stat]) => ({
          id,
          name: stat.name,
          avatar: null,
          actionsCount: stat.count,
          role: stat.count > 15 ? 'Lead Ranger' : 'Local Volunteer',
        }))
        .sort((a, b) => b.actionsCount - a.actionsCount)
        .slice(0, 5);

      // Pad with mock leaders ONLY if in demo mode (but we shouldn't be here if demoMode is true)
      // For live mode, we only show actual leaderboard data.
    }

    // ─── 4. HISTORICAL TIMELINE TRENDS ───────────────────────
    
    const timelineData: TimelineDataPoint[] = [];
    const now = new Date();
    
    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      // Live computation for a given date
      const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dateEnd = dateStart + 24 * 60 * 60 * 1000;

      let refills = updates.filter(u => {
        const t = new Date(u.created_at).getTime();
        return t >= dateStart && t < dateEnd && u.action === 'refilled';
      }).length;

      let cleanups = updates.filter(u => {
        const t = new Date(u.created_at).getTime();
        return t >= dateStart && t < dateEnd && u.action === 'cleaned';
      }).length;

      let emergencies = reports.filter(r => {
        const t = new Date(r.created_at).getTime();
        return t >= dateStart && t < dateEnd;
      }).length;

      if (!demoMode && analyticsEvents && analyticsEvents.length > 0) {
        const emergenciesEvent = analyticsEvents.filter((e: Record<string, unknown>) => {
          const t = new Date(e.created_at as string).getTime();
          return t >= dateStart && t < dateEnd && e.event_type === 'report_created' && ((e.metadata as Record<string, unknown>)?.condition === 'injured' || (e.metadata as Record<string, unknown>)?.condition === 'sick');
        }).length;
        refills = Math.max(refills, emergenciesEvent);

        const refillsEvent = analyticsEvents.filter((e: Record<string, unknown>) => {
          const t = new Date(e.created_at as string).getTime();
          return t >= dateStart && t < dateEnd && e.event_type === 'station_update' && (e.metadata as Record<string, unknown>)?.action === 'refilled';
        }).length;
        refills = Math.max(refills, refillsEvent);

        const cleanupsEvent = analyticsEvents.filter((e: Record<string, unknown>) => {
          const t = new Date(e.created_at as string).getTime();
          return t >= dateStart && t < dateEnd && e.event_type === 'station_update' && (e.metadata as Record<string, unknown>)?.action === 'cleaned';
        }).length;
        cleanups = Math.max(cleanups, cleanupsEvent);
        
        const taskCompletedEvent = analyticsEvents.filter((e: Record<string, unknown>) => {
          const t = new Date(e.created_at as string).getTime();
          return t >= dateStart && t < dateEnd && e.event_type === 'task_completed';
        }).length;
        if (taskCompletedEvent > 0) {
          refills += Math.ceil(taskCompletedEvent / 2);
          cleanups += Math.floor(taskCompletedEvent / 2);
        }
      }

      let health = kpis.networkHealth;

      if (demoMode) {
        // Generate nice-looking simulated timelines
        // Trend up slightly, adding variance
        const baseIndex = (timeRangeDays - i) / timeRangeDays;
        refills = Math.floor(8 + baseIndex * 5 + Math.sin(i) * 3);
        cleanups = Math.floor(4 + baseIndex * 2 + Math.cos(i) * 2);
        emergencies = Math.floor(2 + Math.sin(i * 1.5) * 1.5);
        health = Math.round(82 + Math.sin(i * 0.5) * 4 + baseIndex * 6);
      } else {
        // Live mode uses strictly real data
        // Daily average health
        health = activeStationsCount > 0 ? kpis.networkHealth : 0;
      }

      timelineData.push({
        date: dateStr,
        refills,
        cleanups,
        emergencies,
        health: Math.max(10, Math.min(100, health)),
      });
    }

    return {
      kpis,
      zoneMetrics,
      leaderboard,
      timelineData,
    };
  }, [stations, reports, updates, analyticsEvents, timeRangeDays, demoMode]);
}
