import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();

    // Exchange the OAuth code for a session — CRITICAL for auth persistence
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(new URL('/?error=auth_failed', origin));
    }

    return NextResponse.redirect(new URL('/', origin));
  }

  // No code — just redirect home
  return NextResponse.redirect(new URL('/', origin));
}
