'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Station, AnimalReport, StationUpdate, StationStatus, WaterLevel, EnvironmentState } from './types';
import { DEMO_STATIONS, DEMO_REPORTS, DEMO_UPDATES, CHENNAI_CENTER } from './demo-data';
import { ECOSYSTEM_CONFIG } from './ecosystem-config';
import { eventBus } from './event-bus';


// ─── Demo Configuration ──────────────────────────────────

const UPDATE_INTERVAL = 45_000;   // New activity every 45s
const HEALTH_DECAY_INTERVAL = 60_000; // Health decay check every 60s
const EMERGENCY_INTERVAL = 240_000;   // New emergency every 4min
const VOLUNTEER_NAMES = [
  'Arjun', 'Priya', 'Rahul', 'Meera', 'Karthik', 'Divya',
  'Suresh', 'Ananya', 'Vijay', 'Lakshmi', 'Deepak', 'Kavitha',
  'Ravi', 'Shalini', 'Ganesh',
];

const REFILL_NOTES = [
  'Fresh water added, bowl cleaned',
  'Fed rice and dal mixture',
  'Grain scattered for morning birds',
  'Filled large bucket to brim',
  'Cat food placed in covered spot',
  'Hay and vegetable scraps left',
  'Water tray refreshed and repositioned',
  'Fed chicken bones and rice',
  'Fresh milk kept for kittens',
  'Biscuits and water placed under tree',
];

const CLEANUP_NOTES = [
  'Area swept and garbage removed',
  'Cleaned feeding bowls and surroundings',
  'Removed debris around shelter',
  'Sanitized water station',
  'Cleared drainage near feeding point',
  'Removed plastic waste from area',
];

const REPORT_NOTES = [
  'Dog limping near main road crossing',
  'Kitten found alone near dumpster',
  'Cow with wound on leg near junction',
  'Pack of puppies — no food seen nearby',
  'Cat not eating, looks weak and dehydrated',
  'Bird with broken wing near the park',
  'Dog stuck in fence near construction site',
  'Stray with skin infection near bus stop',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Time-of-Day Awareness ──────────────────────────────

export function getTimeContext(): {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  activeAnimals: string[];
  insight: string;
} {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 10) {
    return {
      period: 'morning',
      label: 'Morning Activity',
      activeAnimals: ['bird', 'cow'],
      insight: 'High bird feeding activity. Water stations in demand near open areas.',
    };
  } else if (hour >= 10 && hour < 16) {
    return {
      period: 'afternoon',
      label: 'Afternoon Watch',
      activeAnimals: ['dog', 'cow'],
      insight: 'Water consumption peaks. Check refill status of nearby stations.',
    };
  } else if (hour >= 16 && hour < 20) {
    return {
      period: 'evening',
      label: 'Evening Operations',
      activeAnimals: ['dog', 'cat', 'mixed'],
      insight: 'Peak dog feeding activity expected. Community volunteers most active now.',
    };
  } else {
    return {
      period: 'night',
      label: 'Night Watch',
      activeAnimals: ['dog'],
      insight: 'Shelter stations prioritized. Dog activity concentrated near residential areas.',
    };
  }
}

export function getCityPulse(env: EnvironmentState): string {
  switch (env) {
    case 'morning': return 'City waking up. High volunteer activity around lake areas.';
    case 'afternoon': return 'Routine patrols active. Heat levels moderate.';
    case 'evening': return 'Peak feeding hour. High density in residential zones.';
    case 'night': return 'Ecosystem resting. Emergency response team on standby.';
    case 'rain': return 'Heavy rain detected. Shelters filling up. Washout risk high.';
    case 'heat': return 'Extreme heat warning. Water evaporation rates critical.';
    default: return 'Ecosystem stable.';
  }
}

// ─── Demo Engine Hook ────────────────────────────────────

export function useDemoEngine(enabled: boolean) {
  const [stations, setStations] = useState<Station[]>(DEMO_STATIONS);
  const [reports, setReports] = useState<AnimalReport[]>(DEMO_REPORTS);
  const [environmentState, setEnvironmentState] = useState<EnvironmentState>('morning');
  const [updates, setUpdates] = useState<StationUpdate[]>(DEMO_UPDATES);
  const [activeMission, setActiveMission] = useState<{
    volunteerId: string;
    volunteerName: string;
    stationId: string;
    eta: number;
    type: 'refill' | 'cleanup' | 'rescue';
  } | null>(null);
  const [demoStats, setDemoStats] = useState({
    volunteersOnline: 12,
    stationsRestored: 0,
    totalUpdates: DEMO_UPDATES.length,
    networkHealth: 87,
  });

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const volunteerShortageActiveRef = useRef(false);

  // Generate a simulated activity update
  const generateUpdate = useCallback(() => {
    setStations((prev) => {
      const mutableStations = [...prev];
      const stationIndex = Math.floor(Math.random() * mutableStations.length);
      const station = { ...mutableStations[stationIndex] };

      // Skip archived stations
      if (station.status === 'archived') return prev;

      const isRefill = Math.random() > 0.35;
      const volunteerName = randomFrom(VOLUNTEER_NAMES);

      if (isRefill) {
        // Refill / restore action
        station.status = 'active';
        station.cleanliness = Math.min(5, station.cleanliness + Math.floor(Math.random() * 2) + 1);
        if (station.type === 'water') {
          station.water_level = 'full';
        }
        station.last_refill = new Date().toISOString();
        station.updated_at = new Date().toISOString();
        station.last_activity_at = new Date().toISOString();

        const newUpdate: StationUpdate = {
          id: generateId(),
          station_id: station.id,
          user_id: `demo-vol-${Math.floor(Math.random() * 15)}`,
          action: 'refilled',
          notes: `${volunteerName}: ${randomFrom(REFILL_NOTES)}`,
          image_url: null,
          created_at: new Date().toISOString(),
        };
        setUpdates((prev) => [newUpdate, ...prev.slice(0, 49)]);

        setDemoStats((prev) => ({
          ...prev,
          stationsRestored: prev.stationsRestored + 1,
          totalUpdates: prev.totalUpdates + 1,
        }));
      } else {
        // Cleanup action
        station.cleanliness = 5;
        station.status = 'active';
        station.updated_at = new Date().toISOString();
        station.last_activity_at = new Date().toISOString();

        const newUpdate: StationUpdate = {
          id: generateId(),
          station_id: station.id,
          user_id: `demo-vol-${Math.floor(Math.random() * 15)}`,
          action: 'cleaned',
          notes: `${volunteerName}: ${randomFrom(CLEANUP_NOTES)}`,
          image_url: null,
          created_at: new Date().toISOString(),
        };
        setUpdates((prev) => [newUpdate, ...prev.slice(0, 49)]);

        setDemoStats((prev) => ({
          ...prev,
          totalUpdates: prev.totalUpdates + 1,
        }));
      }

      mutableStations[stationIndex] = station;
      return mutableStations;
    });
  }, []);

  // Health decay simulation
  const simulateDecay = useCallback(() => {
    const env = environmentState;
    const weatherMult = ECOSYSTEM_CONFIG.decayRates.weatherMultipliers[env] || { water: 1.0, cleanliness: 1.0 };

    setStations((prev) =>
      prev.map((station) => {
        if (station.status === 'archived' || station.status === 'inactive') return station;

        const waterDecayChance = 0.15 * weatherMult.water;
        const cleanlinessDecayChance = 0.15 * weatherMult.cleanliness;

        const updated = { ...station };

        // Water level drops
        if (updated.type === 'water' && Math.random() < waterDecayChance) {
          if (updated.water_level === 'full') {
            updated.water_level = 'half';
          } else if (updated.water_level === 'half') {
            updated.water_level = 'empty';
            updated.status = 'needs_refill';
          }
        }

        // Cleanliness drops
        if (Math.random() < cleanlinessDecayChance && updated.cleanliness > 1) {
          updated.cleanliness = Math.max(1, updated.cleanliness - 1);
          if (updated.cleanliness <= 2) {
            updated.status = 'needs_cleanup';
          }
        }

        updated.updated_at = new Date().toISOString();
        return updated;
      })
    );

    // Update network health
    setDemoStats((prev) => ({
      ...prev,
      networkHealth: Math.max(
        72,
        Math.min(95, prev.networkHealth + (Math.random() > 0.5 ? 1 : -1))
      ),
      volunteersOnline: volunteerShortageActiveRef.current
        ? 2
        : Math.max(
            6,
            Math.min(18, prev.volunteersOnline + (Math.random() > 0.5 ? 1 : -1))
          ),
    }));
  }, [environmentState]);

  // Generate random emergencies & Cascades
  const generateEmergency = useCallback(() => {
    // Cascade Simulation based on weather
    if (environmentState === 'rain' && Math.random() > 0.3) {
      // Rain = Washout / cleanup needed
      setStations(prev => prev.map(s => 
        (s.type === 'feeding' && s.cleanliness > 1) 
          ? { ...s, cleanliness: 1, status: 'needs_cleanup', updated_at: new Date().toISOString() } 
          : s
      ));
      return; // Skip normal report
    } else if (environmentState === 'heat' && Math.random() > 0.3) {
      // Heat = Water empty
      setStations(prev => prev.map(s => 
        (s.type === 'water') 
          ? { ...s, water_level: 'empty', status: 'needs_refill', updated_at: new Date().toISOString() } 
          : s
      ));
      return;
    }

    const conditions: Array<'injured' | 'hungry' | 'sick' | 'aggressive'> = ['injured', 'hungry', 'sick', 'aggressive'];
    const animalTypes = ['dog', 'cat', 'cow', 'bird'];

    const newReport: AnimalReport = {
      id: generateId(),
      reported_by: `demo-user-${Math.floor(Math.random() * 5)}`,
      animal_type: randomFrom(animalTypes),
      condition: randomFrom(conditions),
      lat: CHENNAI_CENTER.lat + (Math.random() - 0.5) * 0.03,
      lng: CHENNAI_CENTER.lng + (Math.random() - 0.5) * 0.03,
      notes: randomFrom(REPORT_NOTES),
      image_url: null,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    setReports((prev) => [newReport, ...prev.slice(0, 14)]);
  }, [environmentState]);

  // Simulate volunteer mission
  const startMissionSimulation = useCallback(() => {
    if (activeMission) return;
    if (volunteerShortageActiveRef.current) return;

    setStations((prev) => {
      const needsAttention = prev.filter(
        (s) => s.status === 'needs_refill' || s.status === 'needs_cleanup'
      );
      if (needsAttention.length === 0) return prev;

      const target = randomFrom(needsAttention);
      const volunteerName = randomFrom(VOLUNTEER_NAMES);
      const eta = Math.floor(Math.random() * 12) + 3;

      setActiveMission({
        volunteerId: `demo-vol-${Math.floor(Math.random() * 15)}`,
        volunteerName,
        stationId: target.id,
        eta,
        type: target.status === 'needs_cleanup' ? 'cleanup' : 'refill',
      });

      // Auto-complete mission after ETA
      setTimeout(() => {
        setStations((curr) =>
          curr.map((s) =>
            s.id === target.id
              ? {
                  ...s,
                  status: 'active' as StationStatus,
                  cleanliness: 5,
                  water_level: (s.type === 'water' ? 'full' : s.water_level) as WaterLevel | null,
                  last_refill: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  last_activity_at: new Date().toISOString(),
                }
              : s
          )
        );

        const completionUpdate: StationUpdate = {
          id: generateId(),
          station_id: target.id,
          user_id: `demo-vol-${Math.floor(Math.random() * 15)}`,
          action: 'completed_task',
          notes: `${volunteerName} completed ${target.status === 'needs_cleanup' ? 'cleanup' : 'refill'} mission`,
          image_url: null,
          created_at: new Date().toISOString(),
        };
        setUpdates((prev) => [completionUpdate, ...prev.slice(0, 49)]);

        setDemoStats((prev) => ({
          ...prev,
          stationsRestored: prev.stationsRestored + 1,
          totalUpdates: prev.totalUpdates + 1,
        }));

        setActiveMission(null);
      }, eta * 1000); // Accelerated for demo (seconds instead of minutes)

      return prev;
    });
  }, [activeMission]);

  const triggerScenario = useCallback((scenarioType: 'heatwave' | 'monsoon' | 'event' | 'clear' | 'gaps') => {
    volunteerShortageActiveRef.current = false;
    
    if (scenarioType === 'heatwave') {
      setTimeout(() => setEnvironmentState('heat'), 0);
      setStations((prev) =>
        prev.map((s) => {
          if (s.status === 'archived' || s.status === 'inactive') return s;
          if (s.type === 'water') {
            return {
              ...s,
              water_level: 'empty',
              status: 'needs_refill',
              updated_at: new Date().toISOString(),
            };
          }
          return s;
        })
      );
      
      const newUpdate: StationUpdate = {
        id: generateId(),
        station_id: DEMO_STATIONS[0].id,
        user_id: 'system',
        action: 'reported_issue',
        notes: 'Heatwave Alert: EVAPORATION CRISIS triggered. Water stations empty.',
        image_url: null,
        created_at: new Date().toISOString(),
      };
      setUpdates((prev) => [newUpdate, ...prev]);
      
      eventBus.emit('SCENARIO_TRIGGERED', {
        name: 'Heatwave Crisis',
        description: 'Ambient temp spikes to 38°C. Evaporation multiplier raises water depletion by 3.5x.',
      });
    } else if (scenarioType === 'monsoon') {
      setEnvironmentState('rain');
      setStations((prev) =>
        prev.map((s) => {
          if (s.status === 'archived' || s.status === 'inactive') return s;
          return {
            ...s,
            cleanliness: 1,
            status: 'needs_cleanup',
            updated_at: new Date().toISOString(),
          };
        })
      );
      
      const newUpdate: StationUpdate = {
        id: generateId(),
        station_id: DEMO_STATIONS[0].id,
        user_id: 'system',
        action: 'reported_issue',
        notes: 'Heavy Rain Alert: MONSOON WASHOUT triggered. Stations require sanitization.',
        image_url: null,
        created_at: new Date().toISOString(),
      };
      setUpdates((prev) => [newUpdate, ...prev]);

      eventBus.emit('SCENARIO_TRIGGERED', {
        name: 'Torrential Monsoon Rain',
        description: 'Monsoon washout alert. Triggers emergency cleanup cascades across all feeding spots.',
      });
    } else if (scenarioType === 'event') {
      setEnvironmentState('evening');
      // Spike at random stations
      setStations((prev) =>
        prev.map((s, idx) => {
          if (s.status === 'archived' || s.status === 'inactive') return s;
          if (idx % 2 === 0) {
            return {
              ...s,
              water_level: 'empty',
              cleanliness: 2,
              status: s.type === 'water' ? 'needs_refill' : 'needs_cleanup',
              updated_at: new Date().toISOString(),
            };
          }
          return s;
        })
      );
      
      const newUpdate: StationUpdate = {
        id: generateId(),
        station_id: DEMO_STATIONS[0].id,
        user_id: 'system',
        action: 'reported_issue',
        notes: 'Festival Night Spike: Feeding and water demand spiked by 2.5x near temple clusters.',
        image_url: null,
        created_at: new Date().toISOString(),
      };
      setUpdates((prev) => [newUpdate, ...prev]);

      eventBus.emit('SCENARIO_TRIGGERED', {
        name: 'Festival Night Feeding Spike',
        description: 'Feeding activity clustered near temple streets. Urgent water and food refills required.',
      });
    } else if (scenarioType === 'gaps') {
      setEnvironmentState('night');
      volunteerShortageActiveRef.current = true;
      setDemoStats((prev) => ({
        ...prev,
        volunteersOnline: 2,
        networkHealth: 74,
      }));
      
      // Make half the stations stale / abandoned by shifting their timestamps way back
      setStations((prev) =>
        prev.map((s, idx) => {
          if (s.status === 'archived' || s.status === 'inactive') return s;
          if (idx % 2 === 1) {
            const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago
            return {
              ...s,
              last_activity_at: staleTime,
              updated_at: staleTime,
              water_level: 'empty',
              cleanliness: 2,
              status: 'needs_refill',
            };
          }
          return s;
        })
      );
      
      const newUpdate: StationUpdate = {
        id: generateId(),
        station_id: DEMO_STATIONS[0].id,
        user_id: 'system',
        action: 'reported_issue',
        notes: 'Volunteer Deficit: Dispatch suspended. Neglected Zones growing.',
        image_url: null,
        created_at: new Date().toISOString(),
      };
      setUpdates((prev) => [newUpdate, ...prev]);

      eventBus.emit('SCENARIO_TRIGGERED', {
        name: 'Volunteer Coverage Gap',
        description: 'Critical volunteer shortage. Auto-dispatch suspended. Neglected zones flagged.',
      });
    } else if (scenarioType === 'clear') {
      // Reset stations and state
      setEnvironmentState('morning');
      setStations(DEMO_STATIONS);
      setUpdates(DEMO_UPDATES);
      setDemoStats({
        volunteersOnline: 12,
        stationsRestored: 0,
        totalUpdates: DEMO_UPDATES.length,
        networkHealth: 87,
      });
      eventBus.emit('SCENARIO_TRIGGERED', {
        name: 'System Reset',
        description: 'Ecosystem simulation restored to baseline operational state.',
      });
    }
  }, []);

  // Start/stop demo engine
  useEffect(() => {
    if (!enabled) {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      return;
    }

    // Reset state
    setTimeout(() => {
      setStations(DEMO_STATIONS);
      setReports(DEMO_REPORTS);
      setUpdates(DEMO_UPDATES);
    }, 0);

    const intervals = [
      setInterval(generateUpdate, UPDATE_INTERVAL),
      setInterval(simulateDecay, HEALTH_DECAY_INTERVAL),
      setInterval(generateEmergency, EMERGENCY_INTERVAL),
      setInterval(startMissionSimulation, 90_000), // Try mission every 90s
      setInterval(() => {
        const states: EnvironmentState[] = ['morning', 'afternoon', 'evening', 'night', 'rain', 'heat'];
        setEnvironmentState(states[Math.floor(Math.random() * states.length)]);
      }, 120_000), // Change weather/time every 2 minutes for demo
    ];

    intervalsRef.current = intervals;

    // Initial burst — generate a few updates quickly to feel alive
    setTimeout(generateUpdate, 3000);
    setTimeout(generateUpdate, 8000);
    setTimeout(startMissionSimulation, 15000);

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [enabled, generateUpdate, simulateDecay, generateEmergency, startMissionSimulation]);

  const updateStationDemo = useCallback((id: string, data: Partial<Station>) => {
    setStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } as Station : s))
    );
  }, []);

  const createStationDemo = useCallback((data: Partial<Station> & { id?: string }) => {
    const newStation = {
      ...data,
      id: data.id || `demo-station-${Date.now()}`,
    } as Station;
    setStations((prev) => [...prev, newStation]);
  }, []);

  const createUpdateDemo = useCallback((data: Partial<StationUpdate>) => {
    const newUpdate: StationUpdate = {
      id: generateId(),
      station_id: data.station_id || '',
      user_id: data.user_id || 'demo-vol',
      action: data.action || 'cleaned',
      notes: data.notes || '',
      image_url: data.image_url || null,
      created_at: new Date().toISOString(),
    };
    setUpdates((prev) => [newUpdate, ...prev]);
  }, []);

  const resolveReportDemo = useCallback((id: string, notes: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: 'resolved', notes: r.notes + `\nResolution: ${notes}` }
          : r
      )
    );
  }, []);

  const createReportDemo = useCallback((data: Partial<AnimalReport> & { id?: string }) => {
    const newReport = {
      ...data,
      id: data.id || `demo-report-${Date.now()}`,
    } as AnimalReport;
    setReports((prev) => [newReport, ...prev]);
  }, []);

  return {
    stations,
    reports,
    updates,
    activeMission,
    demoStats,
    timeContext: getTimeContext(),
    environmentState,
    cityPulse: getCityPulse(environmentState),
    triggerScenario,
    updateStationDemo,
    createStationDemo,
    createUpdateDemo,
    resolveReportDemo,
    createReportDemo,
  };
}
