'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Map, AlertTriangle, Target, Activity, User } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'map', icon: Map, href: '/', label: 'Map' },
  { id: 'report', icon: AlertTriangle, href: '/report', label: 'Report' },
  { id: 'mission', icon: Target, href: '/mission', label: 'Mission' },
  { id: 'activity', icon: Activity, href: '/activity', label: 'Activity' },
  { id: 'profile', icon: User, href: '/profile', label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      id="bottom-navigation"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      aria-label="Main navigation"
    >
      <div className="max-w-[340px] mx-auto pointer-events-auto">
        <div className="bg-white border border-[var(--border-light)] rounded-3xl shadow-lg flex items-center justify-between p-1.5 relative">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            const isMission = item.id === 'mission';

            if (isMission) {
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  aria-label={`${item.label}${isActive ? ' (current)' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(30);
                    router.push(item.href);
                  }}
                  className={`
                    relative flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full
                    -mt-5 transition-transform duration-200 ease-out
                    ${isActive
                      ? 'bg-[#22C55E] text-white shadow-[0_4px_20px_rgba(34,197,94,0.4)] scale-105'
                      : 'bg-[#3B82F6] text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:scale-105'
                    }
                  `}
                >
                  <item.icon
                    size={22}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span className="text-[8px] mt-0.5 font-bold uppercase tracking-wider">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                aria-label={`${item.label}${isActive ? ' (current)' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(20);
                  router.push(item.href);
                }}
                className={`
                  relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl
                  transition-colors duration-200 ease-out
                  ${isActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-gray-400 hover:text-[var(--text-heading)]'
                  }
                `}
              >
                <item.icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span className={`text-[9px] mt-0.5 font-medium ${
                  isActive ? 'text-[var(--accent-primary)]' : 'text-gray-400'
                }`}>
                  {item.label}
                </span>
                
                {/* Active Dot Indicator */}
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--accent-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
