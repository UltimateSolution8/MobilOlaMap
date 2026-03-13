import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../realtime/SocketProvider';
import * as api from '../api/client';
import { DEMO_FALLBACK_LOCATION } from '../config';
import { useActiveTask } from './ActiveTaskContext';

const STORAGE_ONLINE = 'superheroo.helper.online';
const STORAGE_COORDS = 'superheroo.helper.lastCoords';

type HelperCoords = { lat: number; lng: number };

type HelperPresenceContextValue = {
  isOnline: boolean;
  setOnline: (next: boolean) => Promise<void>;
  lastCoords: HelperCoords | null;
  setLastCoords: (coords: HelperCoords | null) => Promise<void>;
};

const HelperPresenceContext = createContext<HelperPresenceContextValue | null>(null);

export function HelperPresenceProvider({ children }: { children: React.ReactNode }) {
  const { status, user, withAuth } = useAuth();
  const socket = useSocket();
  const { activeTaskId } = useActiveTask();

  const [isOnline, setIsOnline] = useState(false);
  const [lastCoords, setLastCoordsState] = useState<HelperCoords | null>(null);
  const [loaded, setLoaded] = useState(false);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastEmitAt = useRef(0);
  const lastApiPingAt = useRef(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_ONLINE);
        const coordsRaw = await AsyncStorage.getItem(STORAGE_COORDS);
        if (cancelled) return;
        setIsOnline(stored === '1');
        setLastCoordsState(coordsRaw ? (JSON.parse(coordsRaw) as HelperCoords) : null);
      } catch {
        if (!cancelled) {
          setIsOnline(false);
          setLastCoordsState(null);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== 'signedIn' || user?.role !== 'HELPER') {
      setIsOnline(false);
      setLastCoordsState(null);
      AsyncStorage.removeItem(STORAGE_ONLINE).catch(() => {});
      AsyncStorage.removeItem(STORAGE_COORDS).catch(() => {});
    }
  }, [status, user?.role]);

  const setOnline = useCallback(async (next: boolean) => {
    setIsOnline(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_ONLINE, '1');
    } else {
      await AsyncStorage.removeItem(STORAGE_ONLINE);
    }
  }, []);

  const setLastCoords = useCallback(async (coords: HelperCoords | null) => {
    setLastCoordsState(coords);
    if (!coords) {
      await AsyncStorage.removeItem(STORAGE_COORDS);
      return;
    }
    await AsyncStorage.setItem(STORAGE_COORDS, JSON.stringify(coords));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (status !== 'signedIn' || user?.role !== 'HELPER') return;
    if (!isOnline || syncingRef.current) return;

    syncingRef.current = true;
    (async () => {
      try {
        let coords = lastCoords;
        if (!coords) {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (servicesEnabled) {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (perm.status === 'granted') {
              const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              await setLastCoords(coords);
            }
          }
        }
        if (!coords && DEMO_FALLBACK_LOCATION) {
          coords = { lat: DEMO_FALLBACK_LOCATION.lat, lng: DEMO_FALLBACK_LOCATION.lng };
          await setLastCoords(coords);
        }
        if (coords) {
          await withAuth((t) => api.helperSetOnline(t, true, coords!.lat, coords!.lng));
        }
      } catch {
        // best-effort
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [isOnline, lastCoords, loaded, status, user?.role, withAuth, setLastCoords]);

  const maybePingApi = useCallback(
    async (coords: HelperCoords | null) => {
      if (!coords) return;
      if (status !== 'signedIn' || user?.role !== 'HELPER' || !isOnline) return;
      const now = Date.now();
      if (now - lastApiPingAt.current < 12_000) return;
      lastApiPingAt.current = now;
      try {
        await withAuth((t) => api.helperSetOnline(t, true, coords.lat, coords.lng));
      } catch {
        // best-effort
      }
    },
    [isOnline, status, user?.role, withAuth],
  );

  useEffect(() => {
    if (!loaded) return;
    if (status !== 'signedIn' || user?.role !== 'HELPER') return;
    if (!isOnline || !socket) return;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const startWatch = async () => {
      try {
        locationSub.current?.remove();
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15_000,
            distanceInterval: 25,
          },
          (pos) => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastEmitAt.current < 4_000) return;
            lastEmitAt.current = now;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLastCoordsState({ lat, lng });
            AsyncStorage.setItem(STORAGE_COORDS, JSON.stringify({ lat, lng })).catch(() => {});
            socket.emit('location.update', { lat, lng, taskId: activeTaskId || undefined });
            maybePingApi({ lat, lng });
          },
        );
      } catch {
        // best-effort
      }
    };

    const startHeartbeat = () => {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        if (cancelled) return;
        const c = lastCoords || null;
        if (!c) return;
        const now = Date.now();
        if (now - lastEmitAt.current < 10_000) return;
        lastEmitAt.current = now;
        socket.emit('location.update', { lat: c.lat, lng: c.lng, taskId: activeTaskId || undefined });
        maybePingApi(c);
      }, 15_000);
    };

    const stopHeartbeat = () => {
      if (!heartbeat) return;
      clearInterval(heartbeat);
      heartbeat = null;
    };

    startWatch();
    startHeartbeat();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        locationSub.current?.remove();
        locationSub.current = null;
        stopHeartbeat();
      } else {
        startWatch();
        startHeartbeat();
      }
    });

    return () => {
      cancelled = true;
      appSub.remove();
      stopHeartbeat();
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [activeTaskId, isOnline, loaded, socket, status, user?.role, lastCoords, maybePingApi]);

  const value = useMemo<HelperPresenceContextValue>(
    () => ({ isOnline, setOnline, lastCoords, setLastCoords }),
    [isOnline, lastCoords, setOnline, setLastCoords],
  );

  return <HelperPresenceContext.Provider value={value}>{children}</HelperPresenceContext.Provider>;
}

export function useHelperPresence() {
  const ctx = useContext(HelperPresenceContext);
  if (!ctx) throw new Error('useHelperPresence must be used within HelperPresenceProvider');
  return ctx;
}
