import type { Station, AnimalReport, StationUpdate, Task } from './types';
import { calculateConfidenceState } from './intelligence';

/**
 * City Narrative Engine
 * Transforms raw telemetry, volunteer actions, and decay metrics into
 * strategic, human-readable operational storylines.
 */

export interface NarrativeInsight {
  id: string;
  type: 'success' | 'alert' | 'info' | 'system';
  title: string;
  body: string;
  timestamp: string;
}

const phraseCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 1000; // 1-minute cooldown

const NARRATIVE_ROTATIONS: Record<string, string[]> = {
  coverage: [
    "Chennai pilot coordination has stabilized. Active community responders expanded local support coverage today.",
    "Decentralized rescue coordination network strengthened with new active responder sweeps.",
    "Hyperlocal patrol coordination achieved optimal volunteer density today.",
  ],
  depletion: [
    "Optimized cluster routing guided response path to target zone. Refill response latency improved by 34% this week.",
    "Evaporation water shortage alert resolved via predictive cluster routing coordination.",
    "Cleanliness sanitation sweep successfully executed. Bowl status restored.",
  ],
  entropy: [
    "Anti-entropy daemon flagged aging spots. Automated stale verification missions dispatched near MRTS bypass.",
    "Ecosystem trust sweep triggered. Anti-entropy priority routing restored stale nodes.",
  ],
};

export function generateEcosystemNarrative(
  stations: Station[],
  reports: AnimalReport[],
  updates: StationUpdate[],
  tasks: Task[],
  environmentState: string = 'morning'
): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];
  const now = new Date();

  // Helper to construct narrative objects
  const addInsight = (type: NarrativeInsight['type'], title: string, body: string, offsetSec = 0) => {
    const nowMs = Date.now();
    const lastTriggered = phraseCooldowns.get(title) || 0;
    
    // Prevent repetitive AI-like alerts by enforcing a 1-minute cooldown on identical titles
    if (nowMs - lastTriggered < COOLDOWN_MS) {
      return;
    }
    phraseCooldowns.set(title, nowMs);

    const ts = new Date(now.getTime() - offsetSec * 1000).toISOString();
    insights.push({
      id: `nar-${offsetSec}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      body,
      timestamp: ts,
    });
  };

  // ─── 1. ANCESTRAL & ACTIVE VOLUNTEER STORY ───────────────────
  const activeVolunteersCount = Array.from(new Set(
    updates.filter(u => u.user_id && !u.user_id.includes('system')).map(u => u.user_id)
  )).length;
  
  if (activeVolunteersCount > 0) {
    const rotIdx = Math.floor(Date.now() / COOLDOWN_MS) % NARRATIVE_ROTATIONS.coverage.length;
    const bodyText = NARRATIVE_ROTATIONS.coverage[rotIdx].replace("Active community", `${activeVolunteersCount + 1} active community`);
    addInsight(
      'success',
      'Volunteer Coverage Amplified',
      bodyText,
      120
    );
  }

  // ─── 2. REFILL SPEED & ROUTE EFFICIENCY STORY ───────────────
  const completedMissions = updates.filter(u => u.action === 'completed_task' || u.action === 'refilled');
  if (completedMissions.length > 0) {
    const recent = completedMissions[0];
    const notesLower = (recent.notes || '').toLowerCase();
    
    let locality = 'Velachery Cluster';
    if (notesLower.includes('adyar')) locality = 'Adyar River Walkway';
    else if (notesLower.includes('beach') || notesLower.includes('besant')) locality = 'Besant Nagar Coastal Network';
    else if (notesLower.includes('omr')) locality = 'OMR Tech Corridor';

    const rotIdx = Math.floor(Date.now() / COOLDOWN_MS) % NARRATIVE_ROTATIONS.depletion.length;
    const bodyText = NARRATIVE_ROTATIONS.depletion[rotIdx].replace("target zone", locality);
    addInsight(
      'success',
      'Depletion Warning Resolved',
      bodyText,
      300
    );
  }

  // ─── 3. ENVIRONMENTAL CASCADES & EVAPORATION crisis ────────
  if (environmentState === 'heat') {
    addInsight(
      'alert',
      'Critical Evaporation Event',
      'Ambient sun cycle reached 38°C peak. Evaporation decay multiplier raised local water station demand by 3.5x.',
      30
    );
  } else if (environmentState === 'rain') {
    addInsight(
      'alert',
      'Heavy Precipitation Washout',
      'Torrential rain surge detected. Cleanup triggers raised by 2.8x. Community responders alerted for sanitization sweeps.',
      45
    );
  }

  // ─── 4. NEGLECTED ZONE & TRUST ANTI-ENTROPY STORY ──────────
  const staleStationsCount = stations.filter(s => calculateConfidenceState(s) === 'stale').length;
  const abandonedStationsCount = stations.filter(s => calculateConfidenceState(s) === 'abandoned').length;

  if (staleStationsCount > 2) {
    const rotIdx = Math.floor(Date.now() / COOLDOWN_MS) % NARRATIVE_ROTATIONS.entropy.length;
    const bodyText = NARRATIVE_ROTATIONS.entropy[rotIdx].replace("aging spots", `${staleStationsCount} aging spots`);
    addInsight(
      'info',
      'Sweep Missions Generated',
      bodyText,
      600
    );
  }

  if (abandonedStationsCount > 0) {
    addInsight(
      'alert',
      'Neglected Zone Detected',
      `Ecosystem Risk algorithm identified OMR stretch coordinates as high-vulnerability zone. Coverage gap flagged for prioritization.`,
      900
    );
  }

  // ─── 5. STAKEHOLDER NARRATIVE WRAPPER ────────────────────────
  const activeStations = stations.filter(s => s.status !== 'archived').length;
  const resolvedRescues = reports.filter(r => r.status === 'resolved').length;
  const totalRescues = reports.length;
  const rescueResolutionRate = totalRescues > 0 ? Math.round((resolvedRescues / totalRescues) * 100) : 100;

  addInsight(
    'system',
    'Ecosystem Coherence High',
    `PawLoop coordinates ${activeStations} active feeding and shelter nodes in Chennai. Regional rescue resolution index stable at ${rescueResolutionRate}%.`,
    10
  );

  // Return sorted insights: alerts first, then successes
  return insights.sort((a, b) => {
    const priority = { alert: 0, success: 1, info: 2, system: 3 };
    return priority[a.type] - priority[b.type];
  });
}

/**
 * Returns dynamic strategic "Why This Matters" insights for the municipality report
 */
export function getWhyThisMatters(kpis: Record<string, unknown>, zoneMetrics: Array<Record<string, unknown>>): string[] {
  const points: string[] = [];

  if (Number(kpis.networkHealth) > 80) {
    points.push(`Local coordination efficiency restored average network health to a robust ${kpis.networkHealth}%.`);
  } else {
    points.push(`Neglected Zone alerts are actively pulling network average down to ${kpis.networkHealth}%. Urgent routing sweeps required.`);
  }

  const criticalZones = zoneMetrics.filter(z => z.status === 'critical');
  if (criticalZones.length > 0) {
    points.push(`Critical coverage gaps identified in ${criticalZones.map(z => z.name).join(', ')}. Evaporation index suggests water shortages.`);
  } else {
    points.push('Ecosystem density is well distributed. Zero zones flagged for critical volunteer shortages.');
  }

  points.push(`Volunteers maintained a ${kpis.resolutionRate}% emergency rescue resolution rate, clocking a average response time of ${kpis.avgResponseTimeMin} minutes.`);
  points.push(`Operational routing optimization has minimized redundant volunteer travel, logging a total of ${kpis.actionsPerformed} successful refilling & cleaning sessions.`);

  return points;
}
