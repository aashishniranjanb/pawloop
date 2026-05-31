# Graph Report - pawloop  (2026-05-30)

## Corpus Check
- 72 files · ~303,151 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 340 nodes · 739 edges · 24 communities (14 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7064a032`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `useDemoContext()` - 24 edges
2. `useRealtime()` - 20 edges
3. `useAuth()` - 19 edges
4. `supabase` - 17 edges
5. `compilerOptions` - 16 edges
6. `Station` - 16 edges
7. `AnimalReport` - 15 edges
8. `useDemoEngine()` - 14 edges
9. `getDB()` - 13 edges
10. `useOfflineSync()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `HomePage()` --calls--> `useDemoContext()`  [EXTRACTED]
  src/app/page.tsx → src/lib/demo-context.tsx
- `HomePage()` --calls--> `useRealtime()`  [EXTRACTED]
  src/app/page.tsx → src/lib/use-realtime.ts
- `CommandCenterPage()` --calls--> `useIntelligence()`  [EXTRACTED]
  src/app/command/page.tsx → src/hooks/use-intelligence.ts
- `LoginPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/app/login/page.tsx → src/lib/auth-context.tsx
- `MissionPage()` --calls--> `useDemoContext()`  [EXTRACTED]
  src/app/mission/page.tsx → src/lib/demo-context.tsx

## Communities (24 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (20): HomePage(), MapView, useIntelligence(), NOTIFICATION_COLORS, NOTIFICATION_ICONS, NotificationCenter(), NotificationCenterProps, useAuth() (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (39): ACTION_CONFIG, NAV_ITEMS, ANIMAL_ICONS, CONDITION_ICONS, TASK_ICONS, ANIMAL_TYPE_EMOJI, ANIMAL_TYPE_LABELS, AnimalReport (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (36): dependencies, clsx, idb, leaflet, leaflet.heat, lucide-react, next, next-pwa (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (19): animalReports, CHENNAI_CENTER, DEMO_STATIONS, feedingStations, now, recentUpdates, shelterStations, waterStations (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (23): ActivityPage(), AnalyticsPage(), CommandCenterPage(), useAnalyticsEvents(), useReports(), useTasks(), useUpdates(), useRealtimeSync() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (15): DEMO_REPORTS, DEMO_UPDATES, CLEANUP_NOTES, getCityPulse(), REFILL_NOTES, REPORT_NOTES, VOLUNTEER_NAMES, ECOSYSTEM_CONFIG (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (16): SyncIndicatorProps, cacheReports(), cacheStations(), cacheUpdates(), clearAllPendingMutations(), getCachedReports(), getCachedStations(), getCachedUpdates() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (29): MapView, InsightsPanelProps, TYPE_STYLES, getTimeContext(), analyzeZones(), calculateConfidenceState(), calculatePriorityScore(), generateInsights() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (10): firaCode, firaSans, inter, metadata, sora, viewport, AuthContext, AuthContextType (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 13 - "Community 13"
Cohesion: 0.40
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **130 isolated node(s):** `eslintConfig`, `withPWA`, `nextConfig`, `name`, `version` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AnimalReport` connect `Community 1` to `Community 0`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `Station` connect `Community 3` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 8`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `withPWA`, `nextConfig` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12962962962962962 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08418367346938775 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._