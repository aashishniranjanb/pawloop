'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  duration: number; // milliseconds
  lat: number;
  lng: number;
  zoom: number;
  action?: 'highlight_urgent' | 'show_mission' | 'show_heat' | 'resolve_station';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'scene1',
    title: 'Heatwave Crisis Detected',
    description: 'OMR Tech Corridor alert: Ambient temps peak at 38°C. Evaporation multiplier raises water depletion risk by 3.5x.',
    duration: 7000,
    lat: 12.9650,
    lng: 80.2450,
    zoom: 14,
    action: 'show_heat',
  },
  {
    id: 'scene2',
    title: 'Water Stations Depleting',
    description: 'Critical evaporation depletes peripheral water station bowls to empty levels. Network health declines.',
    duration: 6500,
    lat: 12.9680,
    lng: 80.2460,
    zoom: 16,
    action: 'highlight_urgent',
  },
  {
    id: 'scene3',
    title: 'Predictive Urgency Dispatch',
    description: 'Ecosystem Intelligence flags neglected zones and auto-generates high-priority refill missions.',
    duration: 6500,
    lat: 12.9680,
    lng: 80.2460,
    zoom: 15,
    action: 'show_mission',
  },
  {
    id: 'scene4',
    title: 'Volunteers Mobilized',
    description: 'Nearby community responders receive instant push alerts and mobilize via optimized cluster routes.',
    duration: 6500,
    lat: 12.9680,
    lng: 80.2460,
    zoom: 16,
    action: 'show_mission',
  },
  {
    id: 'scene5',
    title: 'Ecosystem Recovery',
    description: 'Fresh water stations refilled and verified by Arjun. Regional network health index restored to 94%!',
    duration: 7000,
    lat: 12.9650,
    lng: 80.2450,
    zoom: 14,
    action: 'resolve_station',
  },
];

export function useGuidedTour(mapInstance: LeafletMap | null) {
  const [tourActive, setTourActive] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [tourAction, setTourAction] = useState<TourStep['action']>();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const startTour = useCallback(() => {
    setTourActive(true);
    setCurrentStepIdx(0);
    setTourAction(TOUR_STEPS[0].action);
    if (navigator.vibrate) navigator.vibrate(50);
  }, []);

  const stopTour = useCallback(() => {
    setTourActive(false);
    setCurrentStepIdx(0);
    setTourAction(undefined);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (!tourActive || !mapInstance) return;

    const step = TOUR_STEPS[currentStepIdx];
    
    // Cinematic map movement
    mapInstance.flyTo([step.lat, step.lng], step.zoom, {
      duration: 2.5, // 2.5 seconds for cinematic flight
      easeLinearity: 0.1,
    });

    setTimeout(() => setTourAction(step.action), 0);

    // Schedule next step
    timeoutRef.current = setTimeout(() => {
      if (currentStepIdx < TOUR_STEPS.length - 1) {
        setCurrentStepIdx(prev => prev + 1);
      } else {
        // End of tour
        stopTour();
      }
    }, step.duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tourActive, currentStepIdx, mapInstance, stopTour]);

  return {
    tourActive,
    currentStep: tourActive ? TOUR_STEPS[currentStepIdx] : null,
    tourAction,
    startTour,
    stopTour,
  };
}
