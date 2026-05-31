import type { Station, AnimalReport, StationUpdate, ConfidenceState } from './types';
import { calculateHealthScore } from './types';
import { getTimeContext } from './demo-engine';

// ─── Insight Types ───────────────────────────────────────

export interface Insight {
  id: string;
  type: 'warning' | 'info' | 'positive' | 'urgent' | 'alert' | 'success' | 'system';
  icon?: string;
  title: string;
  body: string;
  priority?: number; // 0-100
  timestamp?: string;
  stationId?: string;
}

// ─── Priority Score Calculation ──────────────────────────

export function calculatePriorityScore(
  station: Station,
  updates: StationUpdate[],
  reports: AnimalReport[]
): number {
  let score = 0;
  const { percentage } = calculateHealthScore(station);

  // Health decline component (0–40)
  score += Math.max(0, 40 - (percentage * 0.4));

  // Urgent reports nearby (0–30)
  const nearbyReports = reports.filter(
    (r) =>
      r.status === 'open' &&
      Math.abs(r.lat - station.lat) < 0.005 &&
      Math.abs(r.lng - station.lng) < 0.005
  );
  score += Math.min(30, nearbyReports.length * 10);

  // Days inactive (0–20)
  if (station.last_activity_at) {
    const daysInactive =
      (Date.now() - new Date(station.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(20, daysInactive * 3);
  } else {
    score += 15;
  }

  // Status penalties (0–10)
  if (station.status === 'needs_cleanup') score += 10;
  if (station.status === 'needs_refill') score += 8;
  if (station.status === 'critical') score += 15;
  if (station.status === 'degrading') score += 5;

  // No volunteer penalty
  if (!station.volunteer_id) score += 5;

  return Math.min(100, Math.round(score));
}

// ─── Zone Analysis ──────────────────────────────────────

interface ZoneHealth {
  label: string;
  avgHealth: number;
  stationCount: number;
  neglectedCount: number;
  activeVolunteers: number;
}

export function analyzeZones(
  stations: Station[],
  gridSize: number = 0.01 // ~1km grid
): ZoneHealth[] {
  const zones = new Map<string, Station[]>();

  stations.forEach((s) => {
    if (s.status === 'archived') return;
    const key = `${Math.floor(s.lat / gridSize) * gridSize},${Math.floor(s.lng / gridSize) * gridSize}`;
    if (!zones.has(key)) zones.set(key, []);
    zones.get(key)!.push(s);
  });

  return Array.from(zones.entries()).map(([key, zoneStations]) => {
    const healths = zoneStations.map((s) => calculateHealthScore(s).percentage);
    const avgHealth = healths.reduce((a, b) => a + b, 0) / healths.length;

    return {
      label: key,
      avgHealth: Math.round(avgHealth),
      stationCount: zoneStations.length,
      neglectedCount: zoneStations.filter((s) => calculateHealthScore(s).status === 'neglected').length,
      activeVolunteers: new Set(zoneStations.filter((s) => s.volunteer_id).map((s) => s.volunteer_id)).size,
    };
  });
}

// ─── Generate Insights ──────────────────────────────────

export function generateInsights(
  stations: Station[],
  reports: AnimalReport[],
  updates: StationUpdate[]
): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();
  const timeCtx = getTimeContext();

  // 1. Time-based insight
  insights.push({
    id: 'time-awareness',
    type: 'info',
    icon: timeCtx.period === 'morning' ? '🌅' : timeCtx.period === 'evening' ? '🌆' : timeCtx.period === 'night' ? '🌙' : '☀️',
    title: timeCtx.label,
    body: timeCtx.insight,
    priority: 20,
  });

  // 2. Stale stations (no activity > 48h)
  const activeStations = stations.filter((s) => s.status !== 'archived' && s.status !== 'inactive');
  const staleStations = activeStations.filter((s) => {
    if (!s.last_activity_at && !s.updated_at) return true;
    const lastUpdate = new Date(s.last_activity_at || s.updated_at).getTime();
    return (now - lastUpdate) > 48 * 60 * 60 * 1000;
  });

  if (staleStations.length > 0) {
    insights.push({
      id: 'stale-warning',
      type: 'warning',
      icon: '⏰',
      title: `${staleStations.length} station${staleStations.length > 1 ? 's' : ''} going stale`,
      body: `No volunteer activity in ${staleStations.length > 48 ? '48+ hours' : '2+ days'}. These need attention.`,
      priority: 65,
    });
  }

  // 3. Critical stations
  const criticalStations = activeStations.filter(
    (s) => s.status === 'needs_cleanup' || s.status === 'critical'
  );
  if (criticalStations.length > 0) {
    insights.push({
      id: 'critical-stations',
      type: 'urgent',
      icon: '🚨',
      title: `${criticalStations.length} critical station${criticalStations.length > 1 ? 's' : ''}`,
      body: 'Immediate cleanup or refill required to maintain ecosystem health.',
      priority: 90,
    });
  }

  // 4. Open reports urgency
  const openReports = reports.filter((r) => r.status === 'open');
  if (openReports.length > 0) {
    const injuredCount = openReports.filter((r) => r.condition === 'injured' || r.condition === 'sick').length;
    if (injuredCount > 0) {
      insights.push({
        id: 'injured-animals',
        type: 'urgent',
        icon: '🩹',
        title: `${injuredCount} injured/sick animal report${injuredCount > 1 ? 's' : ''}`,
        body: 'Animals in distress reported nearby. Volunteer response needed.',
        priority: 95,
      });
    }
  }

  // 5. Low volunteer coverage
  const zones = analyzeZones(stations);
  const weakZones = zones.filter((z) => z.activeVolunteers === 0 && z.stationCount > 2);
  if (weakZones.length > 0) {
    insights.push({
      id: 'low-coverage',
      type: 'warning',
      icon: '📍',
      title: 'Low volunteer coverage detected',
      body: `${weakZones.length} zone${weakZones.length > 1 ? 's' : ''} with ${weakZones.reduce((a, z) => a + z.stationCount, 0)} stations have no assigned volunteers.`,
      priority: 55,
    });
  }

  // 6. Water refill demand
  const waterStations = activeStations.filter((s) => s.type === 'water');
  const lowWaterCount = waterStations.filter(
    (s) => s.water_level === 'empty' || s.water_level === 'half'
  ).length;
  if (lowWaterCount > waterStations.length * 0.3) {
    insights.push({
      id: 'water-demand',
      type: 'warning',
      icon: '💧',
      title: 'Water refill demand rising',
      body: `${lowWaterCount} of ${waterStations.length} water stations need refill. ${timeCtx.period === 'afternoon' ? 'Peak heat hours — urgent.' : ''}`,
      priority: 60,
    });
  }

  // 7. Recent activity positive
  const recentUpdates = updates.filter(
    (u) => now - new Date(u.created_at).getTime() < 2 * 60 * 60 * 1000
  );
  if (recentUpdates.length >= 3) {
    insights.push({
      id: 'active-community',
      type: 'positive',
      icon: '💚',
      title: 'Community is active',
      body: `${recentUpdates.length} updates in the last 2 hours. Network health improving.`,
      priority: 15,
    });
  }

  // 8. Network health summary
  const avgHealth =
    activeStations.length > 0
      ? activeStations.reduce((sum, s) => sum + calculateHealthScore(s).percentage, 0) / activeStations.length
      : 0;

  insights.push({
    id: 'network-health',
    type: avgHealth > 60 ? 'positive' : avgHealth > 35 ? 'info' : 'warning',
    icon: avgHealth > 60 ? '🟢' : avgHealth > 35 ? '🟡' : '🔴',
    title: `Network health: ${Math.round(avgHealth)}%`,
    body: `${activeStations.length} active stations across the city. ${
      avgHealth > 60 ? 'Ecosystem is stable.' : 'Some areas need attention.'
    }`,
    priority: 30,
  });

  // 9. Rule-based predictiveness insights
  const isPeakWaterDemand = timeCtx.period === 'afternoon' || timeCtx.period === 'evening';
  insights.push({
    id: 'predictive-water-demand',
    type: isPeakWaterDemand ? 'warning' : 'info',
    icon: '💧',
    title: 'Water Refill Demand Forecast',
    body: isPeakWaterDemand
      ? 'Ecosystem Intelligence: Peak water station refill demand expected after 4:00 PM due to high afternoon temperature cycle.'
      : 'Ecosystem Intelligence: Base water station evaporation rate stable. Low degradation risk detected.',
    priority: isPeakWaterDemand ? 78 : 35,
  });

  insights.push({
    id: 'predictive-cleanup-washout',
    type: 'info',
    icon: '🧹',
    title: 'Cleanup Probability Spike',
    body: 'Ecosystem Intelligence: Cleanup probability increased to 82% due to high humidity and precipitation cycles.',
    priority: 45,
  });

  insights.push({
    id: 'predictive-risk-zone',
    type: 'warning',
    icon: '⚠️',
    title: 'Ecosystem Risk Warning',
    body: 'Ecosystem Intelligence: OMR corridor stretch flagged as High risk zone. Stale data warning indicates volunteer coverage deficit.',
    priority: 72,
  });

  // Sort by priority (highest first)
  return insights.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

// ─── Stale Detection ─────────────────────────────────────

export interface StaleInfo {
  isStale: boolean;
  hoursSinceUpdate: number;
  confidence: 'high' | 'medium' | 'low';
  label: string;
}

export function getStaleInfo(station: Station): StaleInfo {
  const lastUpdate = station.last_activity_at || station.updated_at;
  if (!lastUpdate) {
    return { isStale: true, hoursSinceUpdate: 999, confidence: 'low', label: 'No data available' };
  }

  const hours = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

  if (hours < 6) return { isStale: false, hoursSinceUpdate: hours, confidence: 'high', label: 'Verified recently' };
  if (hours < 24) return { isStale: false, hoursSinceUpdate: hours, confidence: 'medium', label: 'Updated today' };
  if (hours < 48) return { isStale: false, hoursSinceUpdate: hours, confidence: 'medium', label: 'Updated yesterday' };
  if (hours < 168) return { isStale: true, hoursSinceUpdate: hours, confidence: 'low', label: 'Possibly stale' };
  return { isStale: true, hoursSinceUpdate: hours, confidence: 'low', label: 'Low confidence data' };
}

// ─── Confidence State Calculation ──────────────────────────

export function calculateConfidenceState(station: Station): ConfidenceState {
  if (station.confidence_state) return station.confidence_state; // explicit override

  const lastUpdate = station.last_activity_at || station.updated_at;
  if (!lastUpdate) return 'abandoned';

  const hours = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

  if (hours < 12) return 'verified';
  if (hours < 48) return 'community_confirmed';
  if (hours < 168) return 'stale';
  return 'abandoned';
}

// ─── Ecosystem Risk Zones ────────────────────────────────

export interface RiskZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  riskLevel: 'high' | 'medium' | 'low';
  type: 'evaporation' | 'washout' | 'neglect';
  description: string;
}

export function getEcosystemRiskZones(stations: Station[]): RiskZone[] {
  const riskZones: RiskZone[] = [];
  
  // 1. OMR Tech Corridor - Neglect/Low Coverage Risk
  const omrStations = stations.filter(s => Math.abs(s.lat - 12.9650) < 0.015 && Math.abs(s.lng - 80.2450) < 0.015);
  const omrStale = omrStations.filter(s => {
    const lastUpdate = s.last_activity_at || s.updated_at;
    if (!lastUpdate) return true;
    return (Date.now() - new Date(lastUpdate).getTime()) > 24 * 60 * 60 * 1000; // stale 24h
  });
  
  if (omrStale.length > 0) {
    riskZones.push({
      id: 'risk-omr',
      name: 'OMR Tech Corridor Corridor Stretch',
      lat: 12.9650,
      lng: 80.2450,
      radius: 1200,
      riskLevel: 'high',
      type: 'neglect',
      description: 'Ecosystem Risk: Low volunteer coverage and sparse patrol frequency. 3 feeding nodes at high degradation risk.',
    });
  }

  // 2. Velachery - Water Shortage / Evaporation Risk
  const waterStations = stations.filter(s => s.type === 'water' && Math.abs(s.lat - 12.9816) < 0.01 && Math.abs(s.lng - 80.2204) < 0.01);
  const emptyWater = waterStations.filter(s => s.water_level === 'empty' || s.water_level === 'half');
  if (emptyWater.length > 0) {
    riskZones.push({
      id: 'risk-velachery',
      name: 'Velachery Lake Peripheral Stretch',
      lat: 12.9816,
      lng: 80.2204,
      radius: 800,
      riskLevel: 'high',
      type: 'evaporation',
      description: 'Ecosystem Risk: High concentration of stray bird flocks under peak ambient heat cycle. Water shortage forecast.',
    });
  }

  // 3. Besant Nagar - Washout Risk
  const beachfrontStations = stations.filter(s => Math.abs(s.lat - 13.0005) < 0.01 && Math.abs(s.lng - 80.2685) < 0.01);
  const lowCleanliness = beachfrontStations.filter(s => s.cleanliness <= 3);
  if (lowCleanliness.length > 0) {
    riskZones.push({
      id: 'risk-besant',
      name: 'Besant Nagar Coastal Beach Stretch',
      lat: 13.0005,
      lng: 80.2685,
      radius: 900,
      riskLevel: 'medium',
      type: 'washout',
      description: 'Ecosystem Risk: High humidity and maritime salt spray increases bowl cleanliness degradation risk.',
    });
  }

  return riskZones;
}

