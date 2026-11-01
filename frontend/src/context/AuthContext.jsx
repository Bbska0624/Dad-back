import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { changeAdminRecord, getAdminRecords, getAdminUsers, updateAdminUser } from '../api/admin';
import { request } from '../api/client';
import { getSupabase, supabase } from '../api/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const revision = useRef(0);

  const hydrate = useCallback(async (session) => {
    const currentRevision = ++revision.current;
    setAuthError(null);
    if (!session) {
      setUser(null);
      setAccounts([]);
      setAllRecords([]);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const profile = await request('/account/me', { token: session.access_token });
      if (currentRevision !== revision.current) return null;
      setUser(profile);

      const recordsRequest = profile.role === 'admin'
        ? getAdminRecords({ token: session.access_token })
        : request('/account/records', { token: session.access_token });
      const [records, users] = await Promise.all([
        recordsRequest,
        profile.role === 'admin' ? getAdminUsers({ token: session.access_token }) : Promise.resolve([]),
      ]);
      if (currentRevision !== revision.current) return profile;
      setAllRecords(records);
      setAccounts(users);
      return profile;
    } catch (error) {
      if (currentRevision === revision.current) setAuthError(error);
      throw error;
    } finally {
      if (currentRevision === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrate(session).catch(() => {});
    });
    return () => {
      revision.current += 1;
      subscription.unsubscribe();
    };
  }, [hydrate]);

  async function reload() {
    try {
      const client = getSupabase();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return await hydrate(data.session);
    } catch (error) {
      setAuthError(error);
      throw error;
    }
  }

  async function login(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      if (error.code === 'invalid_credentials') return false;
      throw error;
    }
    if (!data.session) return false;
    return hydrate(data.session);
  }

  async function logout() {
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      setAuthError(error);
      return false;
    }
    return true;
  }

  async function refreshData() {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session) throw Object.assign(new Error('Login required'), { code: 'unauthorized' });
    const token = data.session.access_token;
    const profile = await request('/account/me', { token });
    const recordsRequest = profile.role === 'admin'
      ? getAdminRecords({ token })
      : request('/account/records', { token });
    const [records, users] = await Promise.all([
      recordsRequest,
      profile.role === 'admin' ? getAdminUsers({ token }) : Promise.resolve([]),
    ]);
    setUser(profile);
    setAllRecords(records);
    setAccounts(users);
    setAuthError(null);
    return profile;
  }

  async function updateStatus(id, status) {
    await changeAdminRecord(id, status);
    await refreshData();
  }

  async function changeRecord(id, action) {
    await changeAdminRecord(id, action);
    await refreshData();
  }

  async function updateAccountProfile(id, details) {
    await updateAdminUser(id, { name: details.name, phone: details.phone, goal: details.goal });
    await refreshData();
  }

  const records = allRecords.filter((record) => !record.deletedAt);
  return <AuthContext.Provider value={{
    user, accounts, records, allRecords, loading, authError, reload, login, logout,
    updateStatus, changeRecord, updateAccountProfile,
  }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
