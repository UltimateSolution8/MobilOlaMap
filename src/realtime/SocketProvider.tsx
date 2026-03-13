import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { SOCKET_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

type SocketContextValue = Socket | null;

const SocketContext = createContext<SocketContextValue>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status, accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || !accessToken) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      timeout: 8000,
      reconnectionDelayMax: 3000,
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accessToken]);

  const value = useMemo(() => socket, [socket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
