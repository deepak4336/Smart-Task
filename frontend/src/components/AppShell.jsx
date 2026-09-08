import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useWorkspace } from '../features/workspaces/WorkspaceContext';
import { displayRole, navVisibleForRole } from '../lib/roles';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, roles: ['admin', 'manager', 'member'] },
  {
    to: '/tasks',
    label: 'Tasks',
    matchPrefixes: ['/tasks', '/boards'],
    roles: ['admin', 'manager', 'member'],
  },
  { to: '/tickets', label: 'Tickets', roles: ['admin', 'manager', 'member'] },
  { to: '/reports', label: 'Reports', roles: ['admin', 'manager'] },
  { to: '/profile', label: 'Profile', roles: ['admin', 'manager', 'member'] },
];

function pathMatches(pathname, item) {
  if (item.end) return pathname === item.to;
  if (item.matchPrefixes) {
    return item.matchPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export default function AppShell() {
  const { signOut } = useAuth();
  const { profile, workspaceRole, loading, error } = useWorkspace();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => navVisibleForRole(item.roles, workspaceRole));

  return (
    <div className="app-shell">
      <header className="app-shell-mobilebar">
        <span className="wordmark">
          <span className="wordmark-tag" />
          SmartTask
        </span>
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={mobileNavOpen}
          aria-controls="app-sidebar"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        id="app-sidebar"
        className={`app-sidebar${mobileNavOpen ? ' is-open' : ''}`}
      >
        <NavLink to="/" className="wordmark app-sidebar-brand" onClick={() => setMobileNavOpen(false)}>
          <span className="wordmark-tag" />
          SmartTask
        </NavLink>

        <nav className="app-sidebar-nav" aria-label="Main">
          {items.map((item) => {
            const active = pathMatches(location.pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                className={`app-nav-link${active ? ' is-active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <p className="app-sidebar-name">{profile?.name || 'Account'}</p>
          <p className="app-sidebar-meta">{displayRole(workspaceRole)}</p>
          <button type="button" className="btn-ghost app-sidebar-logout" onClick={signOut}>
            Log out
          </button>
        </div>
      </aside>

      <div className="app-shell-content">
        {error && <div className="form-error app-shell-error">{error}</div>}
        {loading ? <p className="loading-state">Loading…</p> : <Outlet />}
      </div>
    </div>
  );
}
