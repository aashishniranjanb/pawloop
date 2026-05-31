// Deprecated: Please use src/utils/supabase/server.ts instead.
// Standardized on Next.js/Supabase App Router convention.
import { createClient } from '@/utils/supabase/server';

export const createSupabaseServer = createClient;
