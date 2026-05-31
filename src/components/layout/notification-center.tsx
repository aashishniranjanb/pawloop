'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/lib/notification-system';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Target,
  CheckCircle2,
  Users,
  Info,
  X,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/types';

interface NotificationCenterProps {
  demoMode?: boolean;
}

const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  urgency: AlertTriangle,
  volunteer: Target,
  operational: CheckCircle2,
  community: Users,
  system: Info,
};

const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; text: string; border: string }> = {
  urgency: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  volunteer: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  operational: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  community: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  system: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};

export default function NotificationCenter({ demoMode = false }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    markAsRead,
    markAllAsRead,
  } = useNotifications(demoMode);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    // You can handle routing or zoom-to-station here
    if (n.station_id) {
      // Create custom event to center map on station
      window.dispatchEvent(
        new CustomEvent('center-map-station', {
          detail: { stationId: n.station_id },
        })
      );
    }
    setIsOpen(false);
  };

  const handleEnablePush = async () => {
    if (navigator.vibrate) navigator.vibrate(30);
    const result = await requestPermission();
    if (result === 'granted') {
      alert('🔔 Notifications enabled! You will now receive real-time urban pilot alerts.');
    }
  };

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        id="notification-bell"
        onClick={toggleDropdown}
          className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200
          ${isOpen 
            ? 'bg-[#3B82F6] text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]' 
            : 'bg-[#1e293b]/80 border border-white/10 text-gray-400 hover:text-white'
          }
        `}
        title="Alert Notifications"
      >
        <div className="relative">
          <Bell size={20} className={unreadCount > 0 && !isOpen ? 'animate-bell' : ''} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-brand-alert border-2 border-white flex items-center justify-center text-[9px] font-bold text-white px-0.5 animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[340px] rounded-3xl bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-[2000] overflow-hidden animate-slide-up flex flex-col max-h-[480px]">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-gray-800 text-base">Alerts</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-[#3B82F6]/20 text-[#3B82F6] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-[#3B82F6] hover:bg-white/5 flex items-center gap-1 transition-colors duration-200 text-[10px] font-bold"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark Read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Browser Permission Prompt Banner */}
          {permission === 'default' && (
            <div className="bg-brand-forest/5 border-b border-brand-forest/10 px-5 py-3 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Compass className="text-brand-forest shrink-0" size={16} />
                <div className="text-[10px] font-medium text-brand-graphite">
                  Enable browser push notifications for real-time alerts.
                </div>
              </div>
              <button
                onClick={handleEnablePush}
                className="bg-brand-forest text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm active:scale-95 transition-transform shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notification List Scroll Area */}
          <div className="scroll-area flex-1 py-1.5 overflow-y-auto max-h-[380px] bg-white">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
                  <Bell size={24} />
                </div>
                <h4 className="font-heading font-semibold text-gray-700 text-sm mb-1">
                  You are all caught up!
                </h4>
                <p className="text-[11px] text-gray-400 max-w-[200px] leading-relaxed">
                  Realtime water station alerts and emergency reports will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 px-2">
                {notifications.map((n) => {
                  const Icon = NOTIFICATION_ICONS[n.type] || Bell;
                  const colors = NOTIFICATION_COLORS[n.type] || {
                    bg: 'bg-gray-50',
                    text: 'text-gray-400',
                    border: 'border-gray-100',
                  };

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`
                        p-3.5 my-1 rounded-2xl cursor-pointer transition-colors duration-200 border flex gap-3 relative
                        ${n.read
                          ? 'bg-white border-transparent hover:bg-gray-50'
                          : 'bg-blue-50/50 border-blue-100 shadow-sm hover:bg-blue-50'
                        }
                      `}
                    >
                      {/* Unread indicator dot */}
                      {!n.read && (
                        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
                      )}

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center shrink-0 border ${colors.border}`}>
                        <Icon size={16} strokeWidth={2.5} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <h5 className={`text-xs font-semibold leading-snug truncate ${n.read ? 'text-gray-600' : 'text-gray-900 font-bold'}`}>
                            {n.title}
                          </h5>
                        </div>
                        {n.body && (
                          <p className={`text-[10px] mt-1 leading-normal ${n.read ? 'text-gray-500' : 'text-gray-700'}`}>
                            {n.body}
                          </p>
                        )}
                        <span className="text-[9px] text-gray-400 mt-1.5 block font-medium">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer (Total Alerts) */}
          <div className="px-5 py-2.5 border-t border-gray-100 text-center bg-gray-50/80">
            <span className="text-[9px] text-gray-500 font-semibold tracking-wider uppercase">
              PawLoop Civic Alert Engine
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
