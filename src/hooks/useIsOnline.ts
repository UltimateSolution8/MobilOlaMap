import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      setOnline(Boolean(s.isConnected));
    });
    return () => sub();
  }, []);

  return online;
}

