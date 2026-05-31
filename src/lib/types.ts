// ─── Enums ───────────────────────────────────────────────

export type StationType = 'feeding' | 'water' | 'shelter' | 'waste';
export type AnimalType = 'dog' | 'cat' | 'bird' | 'cow' | 'mixed';
export type StationStatus = 'active' | 'needs_refill' | 'needs_cleanup' | 'inactive' | 'archived' | 'degrading' | 'critical';
export type WaterLevel = 'full' | 'half' | 'empty';
export type UpdateAction = 'refilled' | 'cleaned' | 'reported_issue' | 'status_change' | 'created' | 'archived' | 'claimed' | 'completed_task';
export type ReportCondition = 'injured' | 'hungry' | 'aggressive' | 'sick';
export type ReportStatus = 'open' | 'in_progress' | 'resolved';
export type UserRole = 'user' | 'volunteer' | 'admin';

// ─── Health Score ────────────────────────────────────────

export type HealthScore = 'healthy' | 'moderate' | 'neglected';

// ─── Station Lifecycle & Trust ────────────────────────────

export type StationLifecycle = 'created' | 'active' | 'degrading' | 'critical' | 'archived';
export type ConfidenceState = 'verified' | 'community_confirmed' | 'stale' | 'abandoned';
export type EnvironmentState = 'morning' | 'afternoon' | 'evening' | 'night' | 'rain' | 'heat';

// ─── Task System ─────────────────────────────────────────

export type TaskType = 'refill_water' | 'cleanup' | 'rescue' | 'inspection' | 'feeding' | 'verification';
export type TaskStatus = 'pending' | 'claimed' | 'in_progress' | 'completed' | 'expired';

export interface Task {
  id: string;
  station_id: string;
  report_id: string | null;
  type: TaskType;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  priority: number;
  notes: string | null;
  eta_minutes: number | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  station?: Station;
  profile?: Profile;
}

// ─── Notification System ─────────────────────────────────

export type NotificationType = 'operational' | 'urgency' | 'volunteer' | 'community' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  station_id: string | null;
  task_id: string | null;
  read: boolean;
  created_at: string;
}

// ─── Volunteer Stats ─────────────────────────────────────

export interface VolunteerStats {
  stationsMaintained: number;
  tasksCompleted: number;
  refillStreak: number;
  animalsHelped: number;
  activeDays: number;
  responseTimeAvg: number; // minutes
}

// ─── Database Models ─────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Station {
  id: string;
  created_by: string;
  lat: number;
  lng: number;
  type: StationType;
  animal_type: AnimalType;
  status: StationStatus;
  water_level: WaterLevel | null;
  cleanliness: number; // 1-5
  notes: string | null;
  image_url: string | null;
  last_refill: string | null;
  volunteer_id: string | null;
  priority_score?: number;
  last_activity_at?: string;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  // Computed (not in DB)
  health_score?: HealthScore;
  lifecycle?: StationLifecycle;
  confidence_state?: ConfidenceState;
  community_group?: string;
}

export interface StationUpdate {
  id: string;
  station_id: string;
  user_id: string;
  action: UpdateAction;
  notes: string | null;
  image_url: string | null;
  task_id?: string | null;
  created_at: string;
  // Joined
  profile?: Profile;
  station?: Station;
}

export interface AnimalReport {
  id: string;
  reported_by: string;
  animal_type: string;
  condition: ReportCondition;
  lat: number;
  lng: number;
  notes: string | null;
  image_url: string | null;
  status: ReportStatus;
  assigned_to?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  // Joined
  profile?: Profile;
}

// ─── UI Helpers ──────────────────────────────────────────

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'station' | 'report';
  stationType?: StationType;
  status?: StationStatus;
  condition?: ReportCondition;
  animalType?: AnimalType | string;
  label?: string;
}

// ─── Health Score Calculation ────────────────────────────

export function calculateHealthScore(station: Station): { status: HealthScore; percentage: number } {
  let score = 0;

  // Water status (+0 to +30)
  if (station.water_level === 'full') score += 30;
  else if (station.water_level === 'half') score += 15;
  else if (station.water_level === 'empty') score -= 30;

  // Cleanliness (+0 to +25)
  if (station.cleanliness === 5) score += 25;
  else if (station.cleanliness === 4) score += 15;
  else if (station.cleanliness <= 2) score -= 25;

  // Last refill freshness (-20 to +20)
  if (station.last_refill) {
    const hoursSinceRefill = (Date.now() - new Date(station.last_refill).getTime()) / (1000 * 60 * 60);
    if (hoursSinceRefill < 12) score += 20;
    else if (hoursSinceRefill > 48) score -= 20;
  } else {
    score -= 20;
  }

  // Volunteer assigned (+10)
  if (station.volunteer_id) score += 10;

  // Status overrides
  if (station.status === 'needs_cleanup') score -= 25;

  // Staleness penalty
  if (station.last_activity_at) {
    const daysSinceActivity = (Date.now() - new Date(station.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7) score -= 30;
    else if (daysSinceActivity > 3) score -= 15;
  }

  // Normalize score to 0-100 percentage range (assume base 50)
  let percentage = 50 + score;
  percentage = Math.max(0, Math.min(100, percentage));

  let status: HealthScore = 'neglected';
  if (percentage >= 80) status = 'healthy';
  else if (percentage >= 40) status = 'moderate';

  return { status, percentage };
}

// ─── Lifecycle Calculation ───────────────────────────────

export function calculateLifecycle(station: Station): StationLifecycle {
  if (station.status === 'archived') return 'archived';

  const { percentage } = calculateHealthScore(station);
  const daysSinceUpdate = station.updated_at
    ? (Date.now() - new Date(station.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (percentage < 20 || daysSinceUpdate > 14) return 'critical';
  if (percentage < 40 || daysSinceUpdate > 7) return 'degrading';
  if (daysSinceUpdate < 1 && percentage >= 40) return 'active';
  return 'active';
}

// ─── Display Helpers ─────────────────────────────────────

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  feeding: 'Feeding Station',
  water: 'Water Station',
  shelter: 'Shelter',
  waste: 'Waste Collection',
};

export const ANIMAL_TYPE_LABELS: Record<AnimalType, string> = {
  dog: 'Dog',
  cat: 'Cat',
  bird: 'Bird',
  cow: 'Cow',
  mixed: 'Mixed',
};


export const STATUS_LABELS: Record<StationStatus, string> = {
  active: 'Active',
  needs_refill: 'Needs Refill',
  needs_cleanup: 'Needs Cleanup',
  inactive: 'Inactive',
  archived: 'Archived',
  degrading: 'Degrading',
  critical: 'Critical',
};

export const STATUS_COLORS: Record<StationStatus, string> = {
  active: '#1F6F50',
  needs_refill: '#F28C38',
  needs_cleanup: '#E05555',
  inactive: '#999999',
  archived: '#666666',
  degrading: '#D97706',
  critical: '#DC2626',
};

export const CONDITION_LABELS: Record<ReportCondition, string> = {
  injured: 'Injured',
  hungry: 'Hungry',
  aggressive: 'Aggressive',
  sick: 'Sick',
};

export const HEALTH_LABELS: Record<HealthScore, string> = {
  healthy: 'Healthy',
  moderate: 'Moderate',
  neglected: 'Neglected',
};

export const HEALTH_COLORS: Record<HealthScore, string> = {
  healthy: '#1F6F50',
  moderate: '#F28C38',
  neglected: '#E05555',
};

export const WATER_LEVEL_LABELS: Record<WaterLevel, string> = {
  full: 'Full',
  half: 'Half',
  empty: 'Empty',
};

export const LIFECYCLE_LABELS: Record<StationLifecycle, string> = {
  created: 'New',
  active: 'Active',
  degrading: 'Degrading',
  critical: 'Critical',
  archived: 'Archived',
};

export const LIFECYCLE_COLORS: Record<StationLifecycle, string> = {
  created: '#6366F1',
  active: '#1F6F50',
  degrading: '#D97706',
  critical: '#DC2626',
  archived: '#6B7280',
};

export const CONFIDENCE_LABELS: Record<ConfidenceState, string> = {
  verified: 'Verified Recently',
  community_confirmed: 'Community Confirmed',
  stale: 'Stale',
  abandoned: 'Abandoned',
};

export const CONFIDENCE_COLORS: Record<ConfidenceState, string> = {
  verified: '#1F6F50',
  community_confirmed: '#0EA5E9',
  stale: '#D97706',
  abandoned: '#6B7280',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  refill_water: 'Refill Water',
  cleanup: 'Cleanup',
  rescue: 'Rescue',
  inspection: 'Inspection',
  feeding: 'Feeding',
  verification: 'Verification',
};

