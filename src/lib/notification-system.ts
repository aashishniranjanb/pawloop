'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Notification, NotificationType } from './types';

// Rate limiting settings: Max 5 browser alerts per 5 minutes to prevent spamming the desktop
const BROWSER_ALERT_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const CHENNAI_NEIGHBORHOODS = [
  'Velachery MRTS',
  'Adyar River Walkway',
  'Besant Nagar Beach Road',
  'Guindy National Park Periphery',
  'Taramani Bus Depot',
  'Pallikaranai Marsh Edge',
  'Thiruvanmiyur Market',
  'Anna Nagar Tower Park',
];

const VOLUNTEER_NAMES = ['Arjun', 'Priya', 'Karthik', 'Divya', 'Suresh', 'Ananya', 'Rahul', 'Meera'];

export function useNotifications(demoMode: boolean = false) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);

  // Rate limiting ref
  const alertTimestampsRef = useRef<number[]>([]);
  const recentAlertsRef = useRef<Record<string, number>>({});

  // Check initial notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setTimeout(() => setPermission(Notification.permission), 0);
    }
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
    
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      
      // If granted and not in demo mode, perform standard Web Push subscription registration
      if (result === 'granted' && !demoMode) {
        try {
          const { registerPushNotifications } = await import('@/utils/push/vapid');
          await registerPushNotifications();
          console.info('🔔 Web Push PWA subscription registered successfully.');
        } catch (pushErr) {
          console.warn('⚠️ Push subscription upload failed:', pushErr);
        }
      }
      
      return result;
    } catch (err) {
      console.warn('Notification permission request failed:', err);
      return 'default';
    }
  }, [demoMode]);

  // Check rate limit before showing browser alert
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    // Filter timestamps within the current window
    alertTimestampsRef.current = alertTimestampsRef.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    
    if (alertTimestampsRef.current.length >= BROWSER_ALERT_LIMIT) {
      return false; // Rate limit exceeded
    }
    
    alertTimestampsRef.current.push(now);
    return true;
  }, []);

  // Trigger HTML5 Desktop Notification
  const triggerBrowserNotification = useCallback((title: string, body: string, actionUrl: string | null = null) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!checkRateLimit()) {
      console.warn('⚠️ Push notification rate limit reached. Suppressed browser popup.');
      return;
    }

    // Fingerprint deduplication (10 minutes cooldown)
    const fingerprint = `${title}|${body}`;
    const now = Date.now();
    const lastAlertTime = recentAlertsRef.current[fingerprint] || 0;
    if (now - lastAlertTime < 10 * 60 * 1000) {
      console.warn('⚠️ Push notification deduplicated. Fingerprint matches recent alert:', title);
      return;
    }
    recentAlertsRef.current[fingerprint] = now;

    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      
      const n = new window.Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'pawloop-notification',
      });

      if (actionUrl) {
        n.onclick = (e) => {
          e.preventDefault();
          window.focus();
          window.location.href = actionUrl;
        };
      }
    } catch (err) {
      console.warn('Failed to display native browser notification:', err);
    }
  }, [checkRateLimit]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    // Update local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    if (demoMode || !user) return;

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (err) {
      console.warn('Failed to update notification read status in DB:', err);
    }
  }, [demoMode, user]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (demoMode || !user) return;

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    } catch (err) {
      console.warn('Failed to mark all notifications as read in DB:', err);
    }
  }, [demoMode, user]);

  // Fetch in-app notifications
  const fetchNotifications = useCallback(async () => {
    if (demoMode) {
      setLoading(false);
      return;
    }

    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [demoMode, user]);

  // Subscribe to real-time database notifications
  useEffect(() => {
    if (demoMode || !user) return;

    setTimeout(() => {
      fetchNotifications();
    }, 0);

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
            // Alert user with browser alert
            triggerBrowserNotification(
              newNotif.title,
              newNotif.body || 'New alert from PawLoop'
            );
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demoMode, user, fetchNotifications, triggerBrowserNotification]);

  // Demo Mode: Generate simulated notifications periodically
  useEffect(() => {
    if (!demoMode) return;

    // Load initial set of realistic demo notifications
    const initialDemoNotifications: Notification[] = [
      {
        id: 'd-notif-1',
        user_id: 'demo-user',
        type: 'urgency',
        title: '🚨 Refill Critical in Velachery',
        body: 'Water Station near Velachery MRTS is completely empty. 5 animal visitors tracked today.',
        action_url: '#',
        station_id: 'demo-st-1',
        task_id: null,
        read: false,
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'd-notif-2',
        user_id: 'demo-user',
        type: 'volunteer',
        title: '🎯 Priya Claimed Task',
        body: 'Priya has claimed the Cleanup task at Adyar River Walkway. Estimated arrival: 12 minutes.',
        action_url: '#',
        station_id: 'demo-st-2',
        task_id: 'demo-tsk-1',
        read: true,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'd-notif-3',
        user_id: 'demo-user',
        type: 'operational',
        title: '✅ Besant Nagar Refilled',
        body: 'Karthik completed the water refill at Besant Nagar Beach Road. Cleanliness rated: 5/5.',
        action_url: '#',
        station_id: 'demo-st-3',
        task_id: null,
        read: true,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    ];

    setTimeout(() => {
      setNotifications(initialDemoNotifications);
      setLoading(false);
    }, 0);

    // Simulated event templates
    const templates: {
      type: NotificationType;
      title: string;
      body: string;
    }[] = [
      {
        type: 'urgency',
        title: '🚨 Critical Empty Water',
        body: 'Water level is EMPTY at {location}. Severe summer heat warning active in Chennai.',
      },
      {
        type: 'volunteer',
        title: '🎯 Mission Started',
        body: 'Volunteer {volunteer} started a mission session towards {location}.',
      },
      {
        type: 'volunteer',
        title: '✅ Refill Completed',
        body: '{volunteer} refilled the station at {location}. Sanitized area and replenished cat food.',
      },
      {
        type: 'community',
        title: '💚 Hotspot Resolved',
        body: 'Emergency animal rescue report at {location} has been successfully resolved by community coordination!',
      },
      {
        type: 'operational',
        title: '🧹 Cleanup Required',
        body: 'Inspection alert: Station at {location} has been flagged for cleanup by a community member.',
      },
      {
        type: 'system',
        title: 'ℹ️ Smart Routing Active',
        body: ' चेन्नई Multi-point refill task auto-dispatched. Proximity alerts sent to 3 local volunteers.',
      },
    ];

    const generateDemoNotification = () => {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const location = CHENNAI_NEIGHBORHOODS[Math.floor(Math.random() * CHENNAI_NEIGHBORHOODS.length)];
      const volunteer = VOLUNTEER_NAMES[Math.floor(Math.random() * VOLUNTEER_NAMES.length)];
      
      const title = template.title;
      const body = template.body
        .replace('{location}', location)
        .replace('{volunteer}', volunteer);

      const newNotif: Notification = {
        id: `demo-notif-${Date.now()}`,
        user_id: 'demo-user',
        type: template.type,
        title,
        body,
        action_url: '#',
        station_id: `demo-st-${Math.floor(Math.random() * 5)}`,
        task_id: null,
        read: false,
        created_at: new Date().toISOString(),
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 39)]);
      triggerBrowserNotification(title, body);
    };

    // Generate simulated notification every 45 seconds
    const interval = setInterval(generateDemoNotification, 45000);

    return () => clearInterval(interval);
  }, [demoMode, triggerBrowserNotification]);

  // Unread count computation
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    permission,
    loading,
    requestPermission,
    markAsRead,
    markAllAsRead,
    triggerBrowserNotification,
  };
}
