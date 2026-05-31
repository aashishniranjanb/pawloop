/**
 * PawLoop Ecosystem Global Configuration Layer
 * Centralizes all weather multipliers, decay rates, scoring weights, and locality presets.
 */

export interface LocalityPreset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  volunteerDensity: number; // multiplier
  evaporationRate: number; // multiplier
  defaultNotes: string;
}

export const ECOSYSTEM_CONFIG = {
  // ─── Weather & Decay Multipliers ─────────────────────────
  decayRates: {
    baseWaterDecayPerHour: 2.5, // % drop
    baseCleanlinessDecayPerHour: 1.8, // 1-5 drop threshold
    
    weatherMultipliers: {
      morning: { water: 1.0, cleanliness: 1.0 },
      afternoon: { water: 1.5, cleanliness: 1.0 },
      evening: { water: 1.1, cleanliness: 1.1 },
      night: { water: 0.6, cleanliness: 0.8 },
      rain: { water: 0.3, cleanliness: 2.8 }, // Cleanup surge
      heat: { water: 3.5, cleanliness: 0.9 }, // Evaporation crisis
    },
  },

  // ─── Route Scoring & Optimisation ────────────────────────
  routeScoring: {
    urgencyWeight: 1.5,
    clusterWeight: 8.0,
    distancePenaltyWeight: -2.5,
    maxDistanceKm: 4.5,
  },

  // ─── Mission Confidence Tiers (Hours) ────────────────────
  confidenceThresholds: {
    high: 12,      // < 12h: Verified Recently
    medium: 48,    // < 48h: Community Confirmed
    low: 48,       // > 48h: Stale / Abandoned
  },

  // ─── Chennai Pilot Localities ────────────────────────────
  localities: {
    velachery: {
      id: 'velachery',
      name: 'Velachery Pilot Spot',
      lat: 12.9816,
      lng: 80.2204,
      zoom: 14,
      volunteerDensity: 1.2,
      evaporationRate: 1.1,
      defaultNotes: 'Lake peripheral zone. High density of stray birds and mixed dog packs near MRTS lanes.',
    } as LocalityPreset,
    omr: {
      id: 'omr',
      name: 'OMR Tech Corridor',
      lat: 12.9650,
      lng: 80.2450,
      zoom: 14,
      volunteerDensity: 0.8,
      evaporationRate: 1.3,
      defaultNotes: 'Highly sparse IT bypass stretches. Shelter nodes heavily clustered near ongoing construction yards.',
    } as LocalityPreset,
    besantNagar: {
      id: 'besant_nagar',
      name: 'Besant Nagar Coastal Network',
      lat: 13.0005,
      lng: 80.2685,
      zoom: 14,
      volunteerDensity: 1.5,
      evaporationRate: 0.9,
      defaultNotes: 'Beachfront tourist hub. High volunteer activity, but salt water spray triggers cleanliness alerts.',
    } as LocalityPreset,
  },
};
