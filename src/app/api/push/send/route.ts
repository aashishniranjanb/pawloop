import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import webpush from 'web-push';

// Configure VAPID details
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@pawloop.org',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID keys not configured. Web push triggers will fail.');
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify requesting client is authenticated
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id, title, body, actionUrl, stationId } = await request.json();
    if (!user_id || !title) {
      return NextResponse.json({ error: 'Missing user_id or title' }, { status: 400 });
    }

    // Fetch active subscriptions for target user_id
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No push subscriptions found for this volunteer.' });
    }

    const payload = JSON.stringify({
      title,
      body: body || 'New update from PawLoop',
      actionUrl: actionUrl || '/',
      stationId: stationId || null,
      timestamp: new Date().toISOString(),
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys,
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return { endpoint: sub.endpoint, success: true };
      } catch (err: unknown) {
        const statusCode = typeof err === 'object' && err !== null && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.warn('Failed to send push to endpoint:', sub.endpoint, statusCode);
        
        // If subscription is expired or invalid (410 Gone or 404 Not Found), clean it up from database
        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.info('🗑 Deleted expired push subscription:', sub.id);
        }
        
        return { endpoint: sub.endpoint, success: false, error: message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successfulCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      sent: successfulCount,
      total: subscriptions.length,
      results,
    });
  } catch (err: unknown) {
    console.error('Push send API error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
