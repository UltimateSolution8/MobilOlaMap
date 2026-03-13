import Constants from 'expo-constants';

const expoConfig =
  (Constants.expoConfig as { extra?: Record<string, unknown> } | null) ||
  ((Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest ?? null) ||
  ((Constants as unknown as { manifest2?: { extra?: Record<string, unknown> } }).manifest2 ?? null);

const extra = (expoConfig && expoConfig.extra) || {};
const apiFromExtra = typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl.trim() : '';
const socketFromExtra = typeof extra.socketUrl === 'string' ? extra.socketUrl.trim() : '';
const mapsFromExtra = typeof extra.olaMapsApiKey === 'string' ? extra.olaMapsApiKey.trim() : '';
const olaClientIdFromExtra = typeof extra.olaMapsClientId === 'string' ? extra.olaMapsClientId.trim() : '';
const olaClientSecretFromExtra = typeof extra.olaMapsClientSecret === 'string' ? extra.olaMapsClientSecret.trim() : '';
const presignedFromExtra = typeof extra.enablePresignedSelfies === 'string'
  ? extra.enablePresignedSelfies.trim()
  : typeof extra.enablePresignedSelfies === 'boolean'
  ? String(extra.enablePresignedSelfies)
  : '';
const appVariantFromExtra = typeof extra.appVariant === 'string' ? extra.appVariant.trim() : '';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || apiFromExtra || 'https://api.mysuperhero.xyz';

const presignedEnv = process.env.EXPO_PUBLIC_ENABLE_PRESIGNED_SELFIES?.trim();
export const ENABLE_PRESIGNED_SELFIES =
  presignedEnv ? presignedEnv === 'true' : presignedFromExtra ? presignedFromExtra === 'true' : false;

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim() ||
  socketFromExtra ||
  'https://superheroorealtime.onrender.com';

export const OLA_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY?.trim() || mapsFromExtra || '';
export const OLA_MAPS_CLIENT_ID =
  process.env.EXPO_PUBLIC_OLA_MAPS_CLIENT_ID?.trim() || olaClientIdFromExtra || '';
export const OLA_MAPS_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET?.trim() || olaClientSecretFromExtra || '';
export const OLA_MAPS_ENABLED = Boolean(
  OLA_MAPS_API_KEY || (OLA_MAPS_CLIENT_ID && OLA_MAPS_CLIENT_SECRET),
);

export const DEV_SHOW_OTP = process.env.EXPO_PUBLIC_DEV_SHOW_OTP === 'true';

export type AppVariant = 'unified' | 'buyer' | 'helper';

function normalizeAppVariant(raw?: string | null): AppVariant {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'buyer') return 'buyer';
  if (value === 'helper') return 'helper';
  return 'unified';
}

export const APP_VARIANT = normalizeAppVariant(
  process.env.EXPO_PUBLIC_APP_VARIANT || appVariantFromExtra || 'unified',
);

export const LOCKED_ROLE: 'BUYER' | 'HELPER' | null =
  APP_VARIANT === 'buyer' ? 'BUYER' : APP_VARIANT === 'helper' ? 'HELPER' : null;

export const APP_DISPLAY_NAME =
  APP_VARIANT === 'buyer'
    ? 'Superherooo Citizen OlaMaps'
    : APP_VARIANT === 'helper'
    ? 'Superherooo Partner OlaMaps'
    : 'Superherooo OlaMaps';

function parseLatLng(raw?: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export const DEMO_FALLBACK_LOCATION = parseLatLng(process.env.EXPO_PUBLIC_DEMO_FALLBACK_LOCATION);
