import {
  Station,
  StationUpdate,
  AnimalReport,
} from './types';

// ─── Chennai Localities ──────────────────────────────────
// Centered around Velachery / Tambaram / OMR area

const CHENNAI_CENTER = { lat: 12.9816, lng: 80.2204 }; // Velachery

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

const now = new Date();
function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

// ─── 20 Feeding Stations ─────────────────────────────────

const feedingStations: Station[] = [
  {
    id: 'fs-001', created_by: 'demo-user-1',
    lat: 12.9816, lng: 80.2204,
    type: 'feeding', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: '3 dogs here every evening near Velachery MRTS',
    image_url: null, last_refill: hoursAgo(2), volunteer_id: 'demo-vol-1',
    community_group: 'Velachery Lake Care Network',
    created_at: hoursAgo(720), updated_at: hoursAgo(2),
  },
  {
    id: 'fs-002', created_by: 'demo-user-2',
    lat: 12.9785, lng: 80.2178,
    type: 'feeding', animal_type: 'cat', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Cats gather near the tea shop corner',
    image_url: null, last_refill: hoursAgo(4), volunteer_id: 'demo-vol-2',
    community_group: 'OMR Stray Feeders',
    created_at: hoursAgo(480), updated_at: hoursAgo(4),
  },
  {
    id: 'fs-003', created_by: 'demo-user-1',
    lat: 12.9850, lng: 80.2250,
    type: 'feeding', animal_type: 'dog', status: 'needs_refill',
    water_level: null, cleanliness: 3,
    notes: 'Pack of 5 strays, very friendly',
    image_url: null, last_refill: hoursAgo(26), volunteer_id: null,
    created_at: hoursAgo(600), updated_at: hoursAgo(26),
  },
  {
    id: 'fs-004', created_by: 'demo-user-3',
    lat: 12.9750, lng: 80.2150,
    type: 'feeding', animal_type: 'bird', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Crows and pigeons, morning feeding spot',
    image_url: null, last_refill: hoursAgo(8), volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(336), updated_at: hoursAgo(8),
  },
  {
    id: 'fs-005', created_by: 'demo-user-2',
    lat: 12.9880, lng: 80.2280,
    type: 'feeding', animal_type: 'cow', status: 'active',
    water_level: null, cleanliness: 3,
    notes: '2 cows graze here daily',
    image_url: null, last_refill: hoursAgo(12), volunteer_id: null,
    created_at: hoursAgo(500), updated_at: hoursAgo(12),
  },
  {
    id: 'fs-006', created_by: 'demo-user-4',
    lat: 12.9720, lng: 80.2130,
    type: 'feeding', animal_type: 'dog', status: 'needs_cleanup',
    water_level: null, cleanliness: 1,
    notes: 'Near the park entrance — needs urgent cleanup',
    image_url: null, last_refill: hoursAgo(48), volunteer_id: null,
    created_at: hoursAgo(800), updated_at: hoursAgo(48),
  },
  {
    id: 'fs-007', created_by: 'demo-user-1',
    lat: 12.9910, lng: 80.2310,
    type: 'feeding', animal_type: 'mixed', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Community-managed spot, dogs + cats',
    image_url: null, last_refill: hoursAgo(1), volunteer_id: 'demo-vol-3',
    community_group: 'Velachery Lake Care Network',
    created_at: hoursAgo(400), updated_at: hoursAgo(1),
  },
  {
    id: 'fs-008', created_by: 'demo-user-5',
    lat: 12.9790, lng: 80.2260,
    type: 'feeding', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Behind the apartment complex',
    image_url: null, last_refill: hoursAgo(6), volunteer_id: 'demo-vol-2',
    created_at: hoursAgo(200), updated_at: hoursAgo(6),
  },
  {
    id: 'fs-009', created_by: 'demo-user-3',
    lat: 12.9700, lng: 80.2100,
    type: 'feeding', animal_type: 'cat', status: 'needs_refill',
    water_level: null, cleanliness: 3,
    notes: 'Street cats near bus stop',
    image_url: null, last_refill: hoursAgo(30), volunteer_id: null,
    created_at: hoursAgo(300), updated_at: hoursAgo(30),
  },
  {
    id: 'fs-010', created_by: 'demo-user-4',
    lat: 12.9860, lng: 80.2190,
    type: 'feeding', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Temple area — locals help feed',
    image_url: null, last_refill: hoursAgo(3), volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(650), updated_at: hoursAgo(3),
  },
  {
    id: 'fs-011', created_by: 'demo-user-2',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'bird', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Grain feeding point for pigeons',
    image_url: null, last_refill: hoursAgo(5), volunteer_id: null,
    created_at: hoursAgo(150), updated_at: hoursAgo(5),
  },
  {
    id: 'fs-012', created_by: 'demo-user-5',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'School compound — evening spot',
    image_url: null, last_refill: hoursAgo(7), volunteer_id: 'demo-vol-3',
    created_at: hoursAgo(250), updated_at: hoursAgo(7),
  },
  {
    id: 'fs-013', created_by: 'demo-user-1',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'mixed', status: 'needs_refill',
    water_level: null, cleanliness: 2,
    notes: 'Market area — heavy foot traffic',
    image_url: null, last_refill: hoursAgo(36), volunteer_id: null,
    created_at: hoursAgo(500), updated_at: hoursAgo(36),
  },
  {
    id: 'fs-014', created_by: 'demo-user-3',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'cat', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Cat colony — well maintained by residents',
    image_url: null, last_refill: hoursAgo(2), volunteer_id: 'demo-vol-2',
    community_group: 'Tambaram Animal Rescue',
    created_at: hoursAgo(700), updated_at: hoursAgo(2),
  },
  {
    id: 'fs-015', created_by: 'demo-user-4',
    lat: jitter(12.9816, 0.025), lng: jitter(80.2204, 0.025),
    type: 'feeding', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 3,
    notes: 'Highway underpass — 4 dogs permanent',
    image_url: null, last_refill: hoursAgo(10), volunteer_id: null,
    created_at: hoursAgo(400), updated_at: hoursAgo(10),
  },
  {
    id: 'fs-016', created_by: 'demo-user-5',
    lat: jitter(12.9816, 0.025), lng: jitter(80.2204, 0.025),
    type: 'feeding', animal_type: 'dog', status: 'needs_cleanup',
    water_level: null, cleanliness: 1,
    notes: 'Garbage piling up — urgent cleanup',
    image_url: null, last_refill: hoursAgo(60), volunteer_id: null,
    created_at: hoursAgo(350), updated_at: hoursAgo(60),
  },
  {
    id: 'fs-017', created_by: 'demo-user-2',
    lat: jitter(12.9816, 0.025), lng: jitter(80.2204, 0.025),
    type: 'feeding', animal_type: 'cow', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Hay and vegetable scraps — morning',
    image_url: null, last_refill: hoursAgo(14), volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(200), updated_at: hoursAgo(14),
  },
  {
    id: 'fs-018', created_by: 'demo-user-1',
    lat: jitter(12.9816, 0.025), lng: jitter(80.2204, 0.025),
    type: 'feeding', animal_type: 'mixed', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Apartment colony waste-to-feed point',
    image_url: null, last_refill: hoursAgo(4), volunteer_id: 'demo-vol-3',
    created_at: hoursAgo(100), updated_at: hoursAgo(4),
  },
  {
    id: 'fs-019', created_by: 'demo-user-3',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'dog', status: 'inactive',
    water_level: null, cleanliness: 2,
    notes: 'Previously active — no volunteers now',
    image_url: null, last_refill: hoursAgo(168), volunteer_id: null,
    created_at: hoursAgo(900), updated_at: hoursAgo(168),
  },
  {
    id: 'fs-020', created_by: 'demo-user-4',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'feeding', animal_type: 'bird', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Rooftop feeding — sparrows and mynas',
    image_url: null, last_refill: hoursAgo(1), volunteer_id: 'demo-vol-2',
    created_at: hoursAgo(50), updated_at: hoursAgo(1),
  },
];

// ─── 10 Water Stations ──────────────────────────────────

const waterStations: Station[] = [
  {
    id: 'ws-001', created_by: 'demo-user-1',
    lat: 12.9820, lng: 80.2210,
    type: 'water', animal_type: 'mixed', status: 'active',
    water_level: 'full', cleanliness: 5,
    notes: 'Large ceramic bowl — community donated',
    image_url: null, last_refill: hoursAgo(1), volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(500), updated_at: hoursAgo(1),
  },
  {
    id: 'ws-002', created_by: 'demo-user-2',
    lat: 12.9795, lng: 80.2185,
    type: 'water', animal_type: 'dog', status: 'active',
    water_level: 'half', cleanliness: 4,
    notes: 'Plastic tub outside shop',
    image_url: null, last_refill: hoursAgo(8), volunteer_id: null,
    created_at: hoursAgo(300), updated_at: hoursAgo(8),
  },
  {
    id: 'ws-003', created_by: 'demo-user-3',
    lat: 12.9855, lng: 80.2240,
    type: 'water', animal_type: 'bird', status: 'active',
    water_level: 'full', cleanliness: 5,
    notes: 'Bird bath on terrace — kept clean daily',
    image_url: null, last_refill: hoursAgo(3), volunteer_id: 'demo-vol-2',
    created_at: hoursAgo(200), updated_at: hoursAgo(3),
  },
  {
    id: 'ws-004', created_by: 'demo-user-4',
    lat: 12.9740, lng: 80.2140,
    type: 'water', animal_type: 'mixed', status: 'needs_refill',
    water_level: 'empty', cleanliness: 3,
    notes: 'Bowl dry since yesterday — needs refill',
    image_url: null, last_refill: hoursAgo(28), volunteer_id: null,
    created_at: hoursAgo(400), updated_at: hoursAgo(28),
  },
  {
    id: 'ws-005', created_by: 'demo-user-5',
    lat: 12.9890, lng: 80.2270,
    type: 'water', animal_type: 'cow', status: 'active',
    water_level: 'full', cleanliness: 3,
    notes: 'Large bucket near the junction',
    image_url: null, last_refill: hoursAgo(6), volunteer_id: 'demo-vol-3',
    created_at: hoursAgo(250), updated_at: hoursAgo(6),
  },
  {
    id: 'ws-006', created_by: 'demo-user-1',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'water', animal_type: 'dog', status: 'active',
    water_level: 'full', cleanliness: 4,
    notes: 'Steel bowl — cleaned regularly',
    image_url: null, last_refill: hoursAgo(4), volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(350), updated_at: hoursAgo(4),
  },
  {
    id: 'ws-007', created_by: 'demo-user-2',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'water', animal_type: 'mixed', status: 'needs_cleanup',
    water_level: 'half', cleanliness: 1,
    notes: 'Dirty water — needs fresh refill',
    image_url: null, last_refill: hoursAgo(50), volunteer_id: null,
    created_at: hoursAgo(450), updated_at: hoursAgo(50),
  },
  {
    id: 'ws-008', created_by: 'demo-user-3',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'water', animal_type: 'cat', status: 'active',
    water_level: 'full', cleanliness: 5,
    notes: 'Cat water station — apartment maintained',
    image_url: null, last_refill: hoursAgo(2), volunteer_id: 'demo-vol-2',
    created_at: hoursAgo(150), updated_at: hoursAgo(2),
  },
  {
    id: 'ws-009', created_by: 'demo-user-4',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'water', animal_type: 'mixed', status: 'active',
    water_level: 'half', cleanliness: 3,
    notes: 'Near bus stand — moderate traffic',
    image_url: null, last_refill: hoursAgo(12), volunteer_id: null,
    created_at: hoursAgo(280), updated_at: hoursAgo(12),
  },
  {
    id: 'ws-010', created_by: 'demo-user-5',
    lat: jitter(12.9816, 0.02), lng: jitter(80.2204, 0.02),
    type: 'water', animal_type: 'dog', status: 'inactive',
    water_level: 'empty', cleanliness: 2,
    notes: 'Abandoned — bowl cracked',
    image_url: null, last_refill: hoursAgo(200), volunteer_id: null,
    created_at: hoursAgo(600), updated_at: hoursAgo(200),
  },
];

// ─── 5 Shelter Points ────────────────────────────────────

const shelterStations: Station[] = [
  {
    id: 'sh-001', created_by: 'demo-user-1',
    lat: 12.9830, lng: 80.2220,
    type: 'shelter', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Makeshift shelter under bridge — 3 puppies',
    image_url: null, last_refill: null, volunteer_id: 'demo-vol-1',
    created_at: hoursAgo(600), updated_at: hoursAgo(24),
  },
  {
    id: 'sh-002', created_by: 'demo-user-3',
    lat: 12.9760, lng: 80.2160,
    type: 'shelter', animal_type: 'cat', status: 'active',
    water_level: null, cleanliness: 5,
    notes: 'Covered area behind restaurant — safe spot',
    image_url: null, last_refill: null, volunteer_id: 'demo-vol-2',
    created_at: hoursAgo(400), updated_at: hoursAgo(12),
  },
  {
    id: 'sh-003', created_by: 'demo-user-5',
    lat: 12.9905, lng: 80.2300,
    type: 'shelter', animal_type: 'mixed', status: 'needs_cleanup',
    water_level: null, cleanliness: 2,
    notes: 'Construction site shelter — needs attention',
    image_url: null, last_refill: null, volunteer_id: null,
    created_at: hoursAgo(300), updated_at: hoursAgo(72),
  },
  {
    id: 'sh-004', created_by: 'demo-user-2',
    lat: jitter(12.9816, 0.015), lng: jitter(80.2204, 0.015),
    type: 'shelter', animal_type: 'dog', status: 'active',
    water_level: null, cleanliness: 4,
    notes: 'Guard shed — dogs sleep here at night',
    image_url: null, last_refill: null, volunteer_id: 'demo-vol-3',
    created_at: hoursAgo(500), updated_at: hoursAgo(6),
  },
  {
    id: 'sh-005', created_by: 'demo-user-4',
    lat: jitter(12.9816, 0.015), lng: jitter(80.2204, 0.015),
    type: 'shelter', animal_type: 'cow', status: 'active',
    water_level: null, cleanliness: 3,
    notes: 'Open ground with tree shade — 2 cows',
    image_url: null, last_refill: null, volunteer_id: null,
    created_at: hoursAgo(350), updated_at: hoursAgo(48),
  },
];

// ─── Animal Reports ──────────────────────────────────────

const animalReports: AnimalReport[] = [
  {
    id: 'rp-001', reported_by: 'demo-user-1',
    animal_type: 'dog', condition: 'injured',
    lat: 12.9825, lng: 80.2215,
    notes: 'Dog limping near main road — may have been hit',
    image_url: null, status: 'open',
    created_at: hoursAgo(2),
  },
  {
    id: 'rp-002', reported_by: 'demo-user-3',
    animal_type: 'cat', condition: 'sick',
    lat: 12.9770, lng: 80.2155,
    notes: 'Cat not eating, looks weak — near the dumpster',
    image_url: null, status: 'in_progress',
    created_at: hoursAgo(6),
  },
  {
    id: 'rp-003', reported_by: 'demo-user-5',
    animal_type: 'dog', condition: 'hungry',
    lat: 12.9895, lng: 80.2285,
    notes: 'Group of puppies — no food seen nearby',
    image_url: null, status: 'open',
    created_at: hoursAgo(1),
  },
  {
    id: 'rp-004', reported_by: 'demo-user-2',
    animal_type: 'dog', condition: 'aggressive',
    lat: 12.9710, lng: 80.2120,
    notes: 'Dog growling at passersby — seems territorial',
    image_url: null, status: 'open',
    created_at: hoursAgo(4),
  },
  {
    id: 'rp-005', reported_by: 'demo-user-4',
    animal_type: 'cow', condition: 'injured',
    lat: jitter(12.9816, 0.015), lng: jitter(80.2204, 0.015),
    notes: 'Cow with wound on leg — near junction',
    image_url: null, status: 'open',
    created_at: hoursAgo(8),
  },
];

// ─── Activity Updates ────────────────────────────────────

const recentUpdates: StationUpdate[] = [
  {
    id: 'up-001', station_id: 'fs-001', user_id: 'demo-vol-1',
    action: 'refilled', notes: 'Fed rice and chicken bones', image_url: null,
    created_at: hoursAgo(2),
  },
  {
    id: 'up-002', station_id: 'ws-001', user_id: 'demo-vol-1',
    action: 'refilled', notes: 'Filled water bowl to full', image_url: null,
    created_at: hoursAgo(2),
  },
  {
    id: 'up-003', station_id: 'fs-007', user_id: 'demo-vol-3',
    action: 'cleaned', notes: 'Cleaned the area and replaced food', image_url: null,
    created_at: hoursAgo(1),
  },
  {
    id: 'up-004', station_id: 'fs-006', user_id: 'demo-user-4',
    action: 'reported_issue', notes: 'Garbage piling up, urgent cleanup needed', image_url: null,
    created_at: hoursAgo(3),
  },
  {
    id: 'up-005', station_id: 'ws-004', user_id: 'demo-user-4',
    action: 'status_change', notes: 'Bowl is empty, marking for refill', image_url: null,
    created_at: hoursAgo(5),
  },
  {
    id: 'up-006', station_id: 'fs-010', user_id: 'demo-vol-1',
    action: 'refilled', notes: 'Temple prasad distributed', image_url: null,
    created_at: hoursAgo(3),
  },
  {
    id: 'up-007', station_id: 'ws-003', user_id: 'demo-vol-2',
    action: 'refilled', notes: 'Fresh water added to bird bath', image_url: null,
    created_at: hoursAgo(3),
  },
  {
    id: 'up-008', station_id: 'fs-014', user_id: 'demo-vol-2',
    action: 'refilled', notes: 'Cat food and fresh water', image_url: null,
    created_at: hoursAgo(2),
  },
  {
    id: 'up-009', station_id: 'sh-002', user_id: 'demo-vol-2',
    action: 'cleaned', notes: 'Cleaned shelter area', image_url: null,
    created_at: hoursAgo(12),
  },
  {
    id: 'up-010', station_id: 'fs-020', user_id: 'demo-vol-2',
    action: 'created', notes: 'New rooftop feeding point added', image_url: null,
    created_at: hoursAgo(50),
  },
];

// ─── Exports ─────────────────────────────────────────────

export const DEMO_STATIONS: Station[] = [
  ...feedingStations,
  ...waterStations,
  ...shelterStations,
];

export const DEMO_REPORTS: AnimalReport[] = animalReports;
export const DEMO_UPDATES: StationUpdate[] = recentUpdates;
export { CHENNAI_CENTER };
