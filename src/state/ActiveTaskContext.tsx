import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'superheroo.activeTaskId';

type ActiveTaskContextValue = {
  activeTaskId: string | null;
  setActiveTaskId: (taskId: string | null) => Promise<void>;
};

const ActiveTaskContext = createContext<ActiveTaskContextValue | null>(null);

export function ActiveTaskProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        setActiveTaskIdState(stored || null);
      } catch {
        if (!cancelled) setActiveTaskIdState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== 'signedIn') {
      setActiveTaskIdState(null);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, [status]);

  const setActiveTaskId = useCallback(async (taskId: string | null) => {
    setActiveTaskIdState(taskId);
    if (!taskId) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, taskId);
  }, []);

  const value = useMemo<ActiveTaskContextValue>(
    () => ({ activeTaskId, setActiveTaskId }),
    [activeTaskId, setActiveTaskId],
  );

  return <ActiveTaskContext.Provider value={value}>{children}</ActiveTaskContext.Provider>;
}

export function useActiveTask() {
  const ctx = useContext(ActiveTaskContext);
  if (!ctx) throw new Error('useActiveTask must be used within ActiveTaskProvider');
  return ctx;
}
