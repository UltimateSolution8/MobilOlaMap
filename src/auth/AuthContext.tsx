import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import * as api from '../api/client';
import { ApiError } from '../api/http';
import type { AuthResponse, AuthUser, UserRole } from '../api/types';
import { clearAuth, loadAuth, saveAuth } from './storage';
import { registerForPushNotifications } from '../notifications/push';
import { LOCKED_ROLE } from '../config';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  authNotice: string | null;
  clearAuthNotice: () => void;
  startOtp: (phone: string, role: UserRole, channel?: string | null) => Promise<{ otp?: string | null }>;
  verifyOtp: (phone: string, otp: string, role: UserRole) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupWithPassword: (
    email: string,
    password: string,
    role: UserRole,
    phone?: string | null,
    displayName?: string | null,
  ) => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
  withAuth: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
  pinRequired: boolean;
  pinVerified: boolean;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  resetPinVerification: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PIN_KEY = 'superheroo.pin';

function ensureRoleAllowed(user: AuthUser) {
  if (!LOCKED_ROLE) return;
  if (user.role === LOCKED_ROLE) return;
  const msg =
    LOCKED_ROLE === 'BUYER'
      ? 'This app supports citizen accounts only. Please use Superherooo Partner app for helper login.'
      : 'This app supports Superherooo accounts only. Please use Superherooo Citizen app for citizen login.';
  throw new ApiError(msg, { status: 403 });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    accessToken: null,
    refreshToken: null,
    user: null,
  });
  const [pinRequired, setPinRequired] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const pinRef = useRef<string | null>(null);

  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthResponse> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      if (!cancelled) {
        pinRef.current = storedPin ?? null;
        setPinRequired(Boolean(storedPin));
        setPinVerified(false);
      }
      const auth = await loadAuth();
      if (cancelled) return;
      if (!auth) {
        accessRef.current = null;
        refreshRef.current = null;
        setState({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
        return;
      }
      accessRef.current = auth.accessToken;
      refreshRef.current = auth.refreshToken;
      setState({ status: 'signedIn', ...auth });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'signedIn') return;
    if (!state.accessToken || state.user?.role === 'ADMIN') return;
    registerForPushNotifications(state.accessToken);
  }, [state.status, state.accessToken, state.user?.role]);

  const startOtp = useCallback(async (phone: string, role: UserRole, channel?: string | null) => {
    const res = await api.otpStart(phone, role, channel ?? null);
    return { otp: res.devOtp ?? res.otp ?? null };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, role: UserRole) => {
    const auth = await api.otpVerify(phone, otp, role);
    ensureRoleAllowed(auth.user);
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
    setPinVerified(false);
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const auth = await api.passwordLogin(email, password);
    if (auth.user.role === 'ADMIN') {
      throw new ApiError('Admin role is not supported in mobile app.', { status: 400 });
    }
    ensureRoleAllowed(auth.user);
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
    setPinVerified(false);
  }, []);

  const signupWithPassword = useCallback(
    async (email: string, password: string, role: UserRole, phone?: string | null, displayName?: string | null) => {
      if (role === 'ADMIN') {
        throw new ApiError('Admin role is not supported in mobile app.', { status: 400 });
      }
      if (LOCKED_ROLE && role !== LOCKED_ROLE) {
        const msg =
          LOCKED_ROLE === 'BUYER'
            ? 'This app supports citizen sign up only.'
            : 'This app supports Superherooo sign up only.';
        throw new ApiError(msg, { status: 400 });
      }
      const auth = await api.passwordSignup({ email, password, phone: phone || null, displayName: displayName || null, role });
      ensureRoleAllowed(auth.user);
      await saveAuth(auth);
      accessRef.current = auth.accessToken;
      refreshRef.current = auth.refreshToken;
      setState({ status: 'signedIn', ...auth });
      setPinVerified(false);
    },
    [],
  );

  const signOut = useCallback(async (reason?: string) => {
    await clearAuth();
    accessRef.current = null;
    refreshRef.current = null;
    refreshInFlight.current = null;
    setState({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
    setPinVerified(false);
    if (reason) setAuthNotice(reason);
  }, []);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  const setPin = useCallback(async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    pinRef.current = pin;
    setPinRequired(true);
    setPinVerified(true);
  }, []);

  const clearPin = useCallback(async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    pinRef.current = null;
    setPinRequired(false);
    setPinVerified(true);
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    if (!pinRef.current) return true;
    const ok = pinRef.current === pin;
    setPinVerified(ok);
    return ok;
  }, []);

  const resetPinVerification = useCallback(() => {
    if (pinRef.current) {
      setPinVerified(false);
    }
  }, []);

  const refreshTokens = useCallback(async (): Promise<AuthResponse> => {
    const rt = refreshRef.current;
    if (!rt) throw new Error('Missing refresh token');

    if (!refreshInFlight.current) {
      refreshInFlight.current = api.refresh(rt).finally(() => {
        refreshInFlight.current = null;
      });
    }

    const auth = await refreshInFlight.current;
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
    return auth;
  }, []);

  const withAuth = useCallback(
    async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
      const at = accessRef.current;
      if (!at) throw new Error('Not signed in');
      try {
        return await fn(at);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          try {
            const refreshed = await refreshTokens();
            return await fn(refreshed.accessToken);
          } catch {
            await signOut('auth.session_expired');
          }
        }
        throw e;
      }
    },
    [refreshTokens, signOut],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      startOtp,
      verifyOtp,
      loginWithPassword,
      signupWithPassword,
      signOut,
      authNotice,
      clearAuthNotice,
      withAuth,
      pinRequired,
      pinVerified,
      setPin,
      clearPin,
      verifyPin,
      resetPinVerification,
    }),
    [
      state,
      startOtp,
      verifyOtp,
      loginWithPassword,
      signupWithPassword,
      signOut,
      authNotice,
      clearAuthNotice,
      withAuth,
      pinRequired,
      pinVerified,
      setPin,
      clearPin,
      verifyPin,
      resetPinVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
