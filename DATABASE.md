# Database Schema

The core of PawLoop is powered by a robust PostgreSQL database managed via Supabase.

## Tables

### `profiles`
- **Purpose**: Stores extended user profile information and roles.
- **Important Columns**: `id` (UUID), `role` (TEXT), `name` (TEXT), `avatar_url` (TEXT).
- **Relationships**: `id` references `auth.users(id)`.

### `stations`
- **Purpose**: Tracks physical resources in the ecosystem (feeders, water bowls).
- **Important Columns**: `id` (UUID), `lat` (FLOAT), `lng` (FLOAT), `type` (TEXT), `status` (TEXT).
- **Relationships**: `created_by` references `profiles(id)`.

### `reports`
- **Purpose**: Logs emergency or condition alerts for animals or stations.
- **Important Columns**: `id` (UUID), `reported_by` (UUID), `animal_type` (TEXT), `condition` (TEXT), `lat` (FLOAT), `lng` (FLOAT).
- **Relationships**: `reported_by` references `profiles(id)`.

### `tasks`
- **Purpose**: Defines specific actionable items needed in the ecosystem.
- **Important Columns**: `id` (UUID), `station_id` (UUID), `action` (TEXT), `status` (TEXT).
- **Relationships**: `station_id` references `stations(id)`.

### `notifications`
- **Purpose**: Stores pending and historical system notifications for users.
- **Important Columns**: `id` (UUID), `user_id` (UUID), `type` (TEXT), `read` (BOOLEAN).
- **Relationships**: `user_id` references `profiles(id)`.

### `analytics_events`
- **Purpose**: Telemetry store for user actions, used for Intelligence calculations.
- **Important Columns**: `id` (UUID), `event_type` (TEXT), `user_id` (UUID), `metadata` (JSONB).
- **Relationships**: `user_id` references `profiles(id)`.

### `push_subscriptions`
- **Purpose**: Stores web push subscription objects for PWA notifications.
- **Important Columns**: `id` (UUID), `user_id` (UUID), `subscription` (JSONB).
- **Relationships**: `user_id` references `profiles(id)`.
