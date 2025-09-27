import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';

// Mutation keys that should trigger a blocking overlay (security-sensitive actions)
const BLOCKING_KEYS = [
  '/api/profile/password',
  '/api/profile/email',
  '/api/profile',
  '/api/profile/delete',
  '/api/auth/login',
  '/api/auth/register'
];

/**
 * GlobalLoader displays an overlay spinner whenever:
 *  - There are active React Query fetches or mutations
 *  - A route transition just occurred (brief grace period)
 */
export function GlobalLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [location] = useLocation();
  const [recentNav, setRecentNav] = useState(false);

  useEffect(() => {
    setRecentNav(true);
    const t = setTimeout(() => setRecentNav(false), 400); // short nav flash
    return () => clearTimeout(t);
  }, [location]);

  const active = isFetching + isMutating > 0 || recentNav;
  if (!active) return null;

  // Determine blocking mode by inspecting currently tracked mutations via a data attribute heuristic (set externally)
  const body = document.body;
  const blocking = BLOCKING_KEYS.some(k => body.getAttribute('data-busy-'+k) === 'true');

  return (
    <div className={`fixed inset-0 z-50 ${blocking ? 'pointer-events-auto bg-slate-950/40 backdrop-blur-sm flex items-center justify-center' : 'pointer-events-none flex items-start justify-end p-4'}`}>
      <div className={`rounded-full ${blocking ? 'w-16 h-16 bg-slate-900/80' : 'w-11 h-11 bg-slate-900/70'} flex items-center justify-center shadow-lg animate-in fade-in zoom-in`}>
        <div className={`${blocking ? 'h-8 w-8' : 'h-5 w-5'} animate-spin rounded-full border-2 border-primary border-t-transparent`} />
      </div>
    </div>
  );
}

export default GlobalLoader;