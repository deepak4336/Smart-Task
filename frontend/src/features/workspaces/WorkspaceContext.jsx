import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { accessToken } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [me, ws] = await Promise.all([
        api.get('/me', accessToken),
        api.get('/workspaces', accessToken),
      ]);
      setProfile(me.profile || null);
      const list = ws.workspaces || [];
      setWorkspaces(list);
      setActiveWorkspaceId((current) => {
        if (current && list.some((w) => w.id === current)) return current;
        return list[0]?.id ?? null;
      });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setWorkspaces([]);
      setProfile(null);
      setActiveWorkspaceId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [accessToken, refresh]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const workspaceRole = activeWorkspace?.role || profile?.role || 'member';

  const value = useMemo(
    () => ({
      workspaces,
      profile,
      setProfile,
      activeWorkspaceId,
      setActiveWorkspaceId,
      activeWorkspace,
      workspaceRole,
      loading,
      error,
      refresh,
    }),
    [
      workspaces,
      profile,
      activeWorkspaceId,
      activeWorkspace,
      workspaceRole,
      loading,
      error,
      refresh,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
