import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { processQueue } from '../utils/uploadQueue';

export function useUploadQueueProcessor() {
  const processingRef = useRef(false);
  const lastRunRef = useRef(0);

  const run = async () => {
    if (processingRef.current) return;
    const now = Date.now();
    if (now - lastRunRef.current < 4000) return;
    lastRunRef.current = now;
    processingRef.current = true;
    try {
      await processQueue();
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    run();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        run();
      }
    });

    const netSub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        run();
      }
    });

    return () => {
      appSub.remove();
      netSub();
    };
  }, []);
}
