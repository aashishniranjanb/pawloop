# Architecture

PawLoop is built on a modern, reactive, edge-ready architecture designed for rapid iteration, offline capability, and high performance.

## Flow

```text
Frontend (Next.js / Leaflet)
       ↓
Supabase (Auth, Postgres, Realtime)
       ↓
Realtime (Postgres Changes via WebSockets)
       ↓
RPC Intelligence Layer (Edge Functions & DB Triggers)
       ↓
Analytics (Metrics Aggregation)
```

## Core Entities

- **Profiles**: Extended user data tracking roles (e.g., Volunteer, Community Lead, Admin).
- **Stations**: Nodes in the ecosystem (e.g., Water bowls, Feeders) tracking state, health, and location.
- **Reports**: User-submitted alerts regarding animals in distress, missing resources, or general ecosystem conditions.
- **Tasks**: Granular actions required at a specific station (e.g., "Refill Water", "Clean Area").
- **Notifications**: System-generated alerts to inform users of critical ecosystem changes.
- **Analytics Events**: Telemetry and usage metrics used to drive the Narrative Intelligence engine.
