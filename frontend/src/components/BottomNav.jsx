import { NavLink, useLocation } from 'react-router-dom';
import { Home, Megaphone, Inbox, Users, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchReplies } from '../lib/api';

const tabs = [
  { path: '/', icon: Home, label: 'Home', id: 'nav-home' },
  { path: '/campaigns', icon: Megaphone, label: 'Campaigns', id: 'nav-campaigns' },
  { path: '/inbox', icon: Inbox, label: 'Inbox', id: 'nav-inbox', badge: true },
  { path: '/contacts', icon: Users, label: 'Contacts', id: 'nav-contacts' },
  { path: '/settings', icon: Settings, label: 'Settings', id: 'nav-settings' },
];

export default function BottomNav() {
  const location = useLocation();

  // Fetch unread reply count for badge
  const { data: repliesData } = useQuery({
    queryKey: ['unread-replies'],
    queryFn: () => fetchReplies({ isRead: false, pageSize: 1 }),
    refetchInterval: 30_000,
  });

  const unreadCount = repliesData?.total || 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-navy-100 shadow-nav"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      id="bottom-nav"
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {tabs.map(({ path, icon: Icon, label, id, badge }) => {
          const isActive = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              id={id}
              className="flex flex-col items-center justify-center py-2 px-3 relative group"
              style={{ minHeight: '52px', minWidth: '52px' }}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-navy-900' : 'text-navy-400 group-hover:text-navy-600'
                  }`}
                />
                {badge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-danger rounded-full flex items-center justify-center animate-pulse-dot">
                    <span className="text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors duration-200 ${
                  isActive ? 'text-navy-900' : 'text-navy-400 group-hover:text-navy-600'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gold-500 rounded-full" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
