'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; // Will be injected by leaflet.heat plugin
import {
  Station,
  AnimalReport,
  StationUpdate,
  EnvironmentState,
  type AnimalType,
} from '@/lib/types';
import { ANIMAL_ICONS } from '@/lib/icons';
import { PawPrint } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CHENNAI_CENTER } from '@/lib/demo-data';
import { FilterCategory } from './map-filter-bar';
import { useGuidedTour } from '@/lib/demo-tour';
import { getEcosystemRiskZones } from '@/lib/intelligence';


interface MapViewProps {
  stations: Station[];
  reports: AnimalReport[];
  updates: StationUpdate[]; // For heat layer
  showHeatmap: boolean;
  onStationSelect?: (station: Station) => void;
  onReportSelect?: (report: AnimalReport) => void;
  onAddStation?: (lat: number, lng: number) => void;
  filterType?: FilterCategory;
  environmentState?: EnvironmentState;
  reducedMotion?: boolean;
}

export default function MapView({
  stations,
  reports,
  updates,
  showHeatmap,
  onStationSelect,
  onReportSelect,
  onAddStation,
  filterType = 'all',
  environmentState = 'morning',
  reducedMotion = false,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const riskLayerRef = useRef<L.LayerGroup | null>(null);
  const cachedMarkersRef = useRef<Record<string, L.Marker>>({});
  
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [initialCenterDone, setInitialCenterDone] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // ── Demo Tour Integration ────────────────────────────────
  const { tourActive, currentStep, tourAction, startTour } = useGuidedTour(mapInstance);

  useEffect(() => {
    const handleStart = () => startTour();
    window.addEventListener('start-demo-tour', handleStart);
    return () => window.removeEventListener('start-demo-tour', handleStart);
  }, [startTour]);

  useEffect(() => {
    const handleFlyTo = (e: Event) => {
      const customEvent = e as CustomEvent<{ lat: number; lng: number; zoom: number }>;
      if (mapRef.current && customEvent.detail) {
        const { lat, lng, zoom } = customEvent.detail;
        if (reducedMotion) {
          mapRef.current.setView([lat, lng], zoom);
        } else {
          mapRef.current.flyTo([lat, lng], zoom, { duration: 1.5 });
        }
      }
    };
    window.addEventListener('map-fly-to', handleFlyTo);
    return () => window.removeEventListener('map-fly-to', handleFlyTo);
  }, [reducedMotion]);

  // ── Initialize Map ──────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [CHENNAI_CENTER.lat, CHENNAI_CENTER.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: '© CartoDB © OSM' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const riskLayer = L.layerGroup().addTo(map);
    riskLayerRef.current = riskLayer;

    mapRef.current = map;
    setMapInstance(map);

    // Geolocation with high accuracy
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(loc);
        },
        () => {}, // fallback handled
        { enableHighAccuracy: true }
      );
      
      // Watch for moving user
      navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    // Long press
    let pressTimer: ReturnType<typeof setTimeout>;
    map.on('mousedown', (e: L.LeafletMouseEvent) => {
      pressTimer = setTimeout(() => {
        onAddStation?.(e.latlng.lat, e.latlng.lng);
      }, 800);
    });
    map.on('mouseup', () => clearTimeout(pressTimer));
    map.on('mousemove', () => clearTimeout(pressTimer));

    map.on('touchstart' as keyof L.LeafletEventHandlerFnMap, (e: unknown) => {
      const event = e as L.LeafletEvent & { originalEvent: TouchEvent };
      if (event.originalEvent && event.originalEvent.touches.length === 1) {
        const touch = event.originalEvent.touches[0];
        const latlng = map.containerPointToLatLng(
          L.point(touch.clientX - map.getContainer().getBoundingClientRect().left,
                   touch.clientY - map.getContainer().getBoundingClientRect().top)
        );
        pressTimer = setTimeout(() => {
          onAddStation?.(latlng.lat, latlng.lng);
        }, 800);
      }
    });
    map.on('touchend' as keyof L.LeafletEventHandlerFnMap, () => clearTimeout(pressTimer));
    map.on('touchmove' as keyof L.LeafletEventHandlerFnMap, () => clearTimeout(pressTimer));

    return () => {
      map.remove();
      mapRef.current = null;
      heatLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-center on initial location ─────────────────────
  useEffect(() => {
    if (userLocation && mapRef.current && !initialCenterDone && !tourActive) {
      if (reducedMotion) {
        mapRef.current.setView(userLocation, 15);
      } else {
        mapRef.current.flyTo(userLocation, 15, { duration: 1.5 });
      }
      setInitialCenterDone(true);
    }
  }, [userLocation, initialCenterDone, tourActive, reducedMotion]);

  // ── User Location Marker ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (userMarkerRef.current) userMarkerRef.current.remove();

    const icon = L.divIcon({
      className: '',
      html: `
        <div class="marker-user">
          <div class="marker-user__accuracy"></div>
          <div class="marker-user__dot"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    userMarkerRef.current = L.marker(userLocation, { icon, interactive: false })
      .addTo(mapRef.current);
  }, [userLocation]);

  // ── Render Ecosystem Risk Zones ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !riskLayerRef.current) return;
    riskLayerRef.current.clearLayers();

    // Do not show risk zones during guided cinematic tour unless requested
    if (tourActive) return;

    const riskZones = getEcosystemRiskZones(stations);

    riskZones.forEach((zone) => {
      const color = zone.riskLevel === 'high' ? '#EF4444' : '#F59E0B';
      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '5, 5',
      }).addTo(riskLayerRef.current!);

      // Add a clean strategic popup/tooltip
      circle.bindTooltip(`
        <div style="padding: 6px; font-family: sans-serif; min-width: 160px; max-width: 220px; white-space: normal;">
          <strong style="color: ${color}; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">${zone.riskLevel} Degradation Risk</strong>
          <h4 style="margin: 0 0 4px; font-size: 12px; color: #111827; font-weight: bold;">${zone.name}</h4>
          <p style="margin: 0; font-size: 10px; color: #4B5563; line-height: 1.3;">${zone.description}</p>
        </div>
      `, {
        sticky: true,
        direction: 'top',
        className: 'risk-zone-tooltip',
      });
    });
  }, [stations, reports, tourActive]);

  // ── Render Heat Layer ──────────────────────────────────
  useEffect(() => {
    const leafletHeat = (L as unknown as { heatLayer?: (points: number[][], options: Record<string, unknown>) => L.Layer }).heatLayer;
    if (!mapRef.current || typeof leafletHeat !== 'function') return;

    const isHeatmapForced = tourAction === 'show_heat' || showHeatmap;

    if (isHeatmapForced) {
      // Map updates to heatmap points [lat, lng, intensity]
      const heatPoints = updates.reduce((acc, update) => {
        const st = stations.find(s => s.id === update.station_id);
        if (st) {
          const daysOld = (Date.now() - new Date(update.created_at).getTime()) / (1000 * 60 * 60 * 24);
          const intensity = Math.max(0.1, 1 - (daysOld / 7)); 
          acc.push([st.lat, st.lng, intensity]);
        }
        return acc;
      }, [] as number[][]);

      if (heatLayerRef.current) {
        heatLayerRef.current.remove();
      }
      heatLayerRef.current = leafletHeat(heatPoints, {
        radius: 35,
        blur: 25,
        maxZoom: 15,
        gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1: 'red' }
      }).addTo(mapRef.current);
    } else {
      if (heatLayerRef.current) {
        heatLayerRef.current.remove();
        heatLayerRef.current = null;
      }
    }
  }, [showHeatmap, tourAction, updates, stations]);

  // ── Render Markers ──────────────────────────────────────
  const renderMarkers = useCallback(() => {
    if (!markersLayerRef.current) return;

    // Smart Filtering Logic
    let filteredStations = stations;
    let filteredReports = reports;

    if (filterType === 'dogs') filteredStations = stations.filter(s => s.animal_type === 'dog');
    else if (filterType === 'cats') filteredStations = stations.filter(s => s.animal_type === 'cat');
    else if (filterType === 'water') filteredStations = stations.filter(s => s.type === 'water');
    else if (filterType === 'shelters') filteredStations = stations.filter(s => s.type === 'shelter');
    else if (filterType === 'cleanup') {
      filteredStations = stations.filter(s => s.status === 'needs_cleanup');
      filteredReports = [];
    }
    else if (filterType === 'urgent') {
      filteredStations = stations.filter(s => s.status === 'needs_refill' || s.status === 'needs_cleanup');
      filteredReports = reports.filter(r => r.status === 'open');
    }

    if (filterType !== 'all' && filterType !== 'urgent') {
      filteredReports = [];
    }

    // Hide station markers completely if heatmap is on (cleaner UI)
    const isHeatmapForced = tourAction === 'show_heat' || showHeatmap;
    if (isHeatmapForced && filterType === 'all') {
      filteredStations = [];
      filteredReports = [];
    }

    // 1. Compile all active IDs that should be drawn
    const activeIds = new Set<string>();
    filteredStations.forEach(s => activeIds.add(s.id));
    filteredReports.forEach(r => activeIds.add(r.id));

    // 2. Remove markers that are no longer active
    Object.entries(cachedMarkersRef.current).forEach(([id, marker]) => {
      if (!activeIds.has(id)) {
        marker.remove();
        delete cachedMarkersRef.current[id];
      }
    });

    // 3. Process stations
    filteredStations.forEach((station) => {
      let status = station.status;
      if (tourAction === 'highlight_urgent' && station.id.includes('b0000000-0000-0000-0000-000000000004')) {
        status = 'needs_refill';
      }
      if (tourAction === 'resolve_station' && station.id.includes('b0000000-0000-0000-0000-000000000004')) {
        status = 'active';
      }

      const AnimalIcon = ANIMAL_ICONS[station.animal_type as AnimalType] || PawPrint;
      const emoji = renderToStaticMarkup(<AnimalIcon size={20} color="currentColor" />);
      const cacheKey = station.id;
      const cached = cachedMarkersRef.current[cacheKey];

      const htmlContent = `
        <div class="marker-station marker-station--${status}">
          <div class="marker-station__ring"></div>
          <div class="marker-station__inner">${emoji}</div>
        </div>
      `;

      if (cached) {
        const cachedMarker = cached as L.Marker & { _status?: string, _emoji?: string };
        // If status changed, update the icon
        if (cachedMarker._status !== status || cachedMarker._emoji !== emoji) {
          const newIcon = L.divIcon({
            className: '',
            html: htmlContent,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
          cached.setIcon(newIcon);
          cachedMarker._status = status;
          cachedMarker._emoji = emoji;
        }
        // If position changed, update position in-place
        const currLatLng = cached.getLatLng();
        if (currLatLng.lat !== station.lat || currLatLng.lng !== station.lng) {
          cached.setLatLng([station.lat, station.lng]);
        }
      } else {
        // Create marker
        const icon = L.divIcon({
          className: '',
          html: htmlContent,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        const marker = L.marker([station.lat, station.lng], { icon }).addTo(markersLayerRef.current!);
        const extMarker = marker as L.Marker & { _status?: string, _emoji?: string };
        extMarker._status = status;
        extMarker._emoji = emoji;
        
        marker.on('click', () => {
          if (mapRef.current && !tourActive) {
            if (reducedMotion) {
              mapRef.current.setView([station.lat, station.lng], mapRef.current.getZoom());
            } else {
              mapRef.current.panTo([station.lat, station.lng], { animate: true, duration: 0.5 });
            }
          }
          if (!tourActive) {
            window.dispatchEvent(new CustomEvent('station-select', { detail: station.id }));
            onStationSelect?.(station);
          }
        });

        cachedMarkersRef.current[cacheKey] = marker;
      }
    });

    // 4. Process reports
    filteredReports.forEach((report) => {
      const cacheKey = report.id;
      const cached = cachedMarkersRef.current[cacheKey];
      const htmlContent = `
        <div class="marker-report">
          <div class="marker-report__ring"></div>
          <div class="marker-report__inner">⚠️</div>
        </div>
      `;

      if (cached) {
        const currLatLng = cached.getLatLng();
        if (currLatLng.lat !== report.lat || currLatLng.lng !== report.lng) {
          cached.setLatLng([report.lat, report.lng]);
        }
      } else {
        const icon = L.divIcon({
          className: '',
          html: htmlContent,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const marker = L.marker([report.lat, report.lng], { icon }).addTo(markersLayerRef.current!);
        marker.on('click', () => {
          if (!tourActive) onReportSelect?.(report);
        });

        cachedMarkersRef.current[cacheKey] = marker;
      }
    });

    // Demo Tour Mission Animation
    if (tourAction === 'show_mission' && currentStep) {
      const routeIcon = L.divIcon({
        className: 'marker-user animate-pulse',
        html: `<div style="width: 12px; height: 12px; background: #3B82F6; border-radius: 50%; box-shadow: 0 0 10px #3B82F6"></div>`,
        iconSize: [12, 12],
      });
      L.marker([currentStep.lat + 0.005, currentStep.lng - 0.005], { icon: routeIcon }).addTo(markersLayerRef.current!);
    }

  }, [filterType, showHeatmap, tourAction, tourActive, currentStep, stations, reports, onReportSelect, onStationSelect, reducedMotion]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // ── Locate user button ──────────────────────────────────
  const flyToUser = useCallback(() => {
    if (tourActive || !mapRef.current) return;
    const loc = userLocation || [CHENNAI_CENTER.lat, CHENNAI_CENTER.lng] as [number, number];
    if (reducedMotion) {
      mapRef.current.setView(loc, 16);
    } else {
      mapRef.current.flyTo(loc, 16, { duration: 1.2 });
    }
  }, [userLocation, tourActive, reducedMotion]);

  const envClasses = {
    morning: 'hue-rotate-15 sepia-[.2]',
    afternoon: 'saturate-150',
    evening: 'sepia-[.3] hue-rotate-[-10deg] brightness-95',
    night: 'invert-[.8] hue-rotate-180 brightness-75',
    rain: 'grayscale-[.3] brightness-90 contrast-75 saturate-50',
    heat: 'sepia-[.4] saturate-200 brightness-110 hue-rotate-[-10deg]',
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0A0E27]">
      <div ref={mapContainerRef} className={`w-full h-full transition-[filter] duration-1000 ${envClasses[environmentState]}`} />
      
      {/* Weather Overlays */}
      {environmentState === 'rain' && (
        <div className="absolute inset-0 pointer-events-none z-[400] bg-blue-900/10 mix-blend-overlay"></div>
      )}
      {environmentState === 'night' && (
        <div className="absolute inset-0 pointer-events-none z-[400] bg-indigo-900/20 mix-blend-overlay"></div>
      )}
      {environmentState === 'heat' && (
        <div className="absolute inset-0 pointer-events-none z-[400] bg-orange-500/10 mix-blend-color-burn"></div>
      )}
      
      {/* Tour Overlay HUD */}
      {tourActive && currentStep && (
        <div className="absolute inset-x-0 top-32 z-[2000] px-4 pointer-events-none animate-slide-down">
          <div className="surface-glass p-5 rounded-2xl shadow-card border border-white/20 backdrop-blur-xl">
            <h2 className="font-heading text-lg font-bold text-brand-graphite mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-sky animate-pulse" />
              {currentStep.title}
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed max-w-[280px]">
              {currentStep.description}
            </p>
          </div>
        </div>
      )}

      {!tourActive && (
        <>
          <button
            id="btn-locate-me"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              flyToUser();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute z-[1000] w-11 h-11 rounded-xl
                       bg-[#1e293b]/90 backdrop-blur-sm border border-white/10
                       shadow-float flex items-center justify-center
                       hover:bg-[#2d3a4f] active:scale-95
                       transition-transform duration-200"
            style={{ top: 100, right: 16 }}
            title="My location"
            aria-label="Center map on my location"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
          
          <button
            id="btn-add-station"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (mapRef.current) {
                const center = mapRef.current.getCenter();
                onAddStation?.(center.lat, center.lng);
              } else if (userLocation) {
                onAddStation?.(userLocation[0], userLocation[1]);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute z-[1000] w-11 h-11 rounded-xl
                       bg-[#3B82F6] backdrop-blur-sm border border-white/20
                       shadow-[0_4px_12px_rgba(59,130,246,0.3)] flex items-center justify-center
                       hover:bg-[#2563EB] active:scale-95
                       transition-all duration-200"
            style={{ top: 156, right: 16 }}
            title="Create Station"
            aria-label="Create new station here"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
