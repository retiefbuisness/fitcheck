import { Bell, Camera, House, Shirt, Sparkles, User } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUserId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Spinner } from './ui';

const TABS = [
  { to: '/', label: 'Feed', icon: House, end: true },
  { to: '/closet', label: 'Closet', icon: Shirt },
  { to: '/style', label: 'Style me', icon: Sparkles },
  { to: '/fit-check', label: 'Fit check', icon: Camera },
  { to: '/profile', label: 'Profile', icon: User },
];

export function Layout() {
  const userId = useUserId();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [userId, location.pathname]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Fit<span>Check</span>
        </Link>
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <span className="spacer" />
        <div className="actions">
          <Link to="/notifications" className="icon-btn" aria-label="Activity">
            <Bell size={22} />
            {unread > 0 ? <span className="badge">{unread > 99 ? '99+' : unread}</span> : null}
          </Link>
        </div>
      </header>
      <main className="page">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
