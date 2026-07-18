import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ─────────────────────────────────────────────────────────────────────────────
// useNetwork — Reactive network connectivity hook
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export function useNetwork(): NetworkState {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected:         true,
    isInternetReachable: true,
    type:                null,
  });

  useEffect(() => {
    // Fetch the initial state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      setNetworkState({
        isConnected:         state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? null,
        type:                state.type,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isConnected:         state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? null,
        type:                state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return networkState;
}
