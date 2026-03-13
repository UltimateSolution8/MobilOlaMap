import * as SecureStore from 'expo-secure-store';
import type { AuthResponse } from '../api/types';

const K_ACCESS = 'him.accessToken';
const K_REFRESH = 'him.refreshToken';
const K_USER = 'him.user';

export async function loadAuth(): Promise<AuthResponse | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(K_ACCESS),
    SecureStore.getItemAsync(K_REFRESH),
    SecureStore.getItemAsync(K_USER),
  ]);

  if (!accessToken || !refreshToken || !userJson) return null;
  try {
    const user = JSON.parse(userJson);
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export async function saveAuth(auth: AuthResponse): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(K_ACCESS, auth.accessToken),
    SecureStore.setItemAsync(K_REFRESH, auth.refreshToken),
    SecureStore.setItemAsync(K_USER, JSON.stringify(auth.user)),
  ]);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(K_ACCESS),
    SecureStore.deleteItemAsync(K_REFRESH),
    SecureStore.deleteItemAsync(K_USER),
  ]);
}

