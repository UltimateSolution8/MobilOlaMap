import {
  OLA_MAPS_API_KEY,
  OLA_MAPS_CLIENT_ID,
  OLA_MAPS_CLIENT_SECRET,
  OLA_MAPS_ENABLED,
} from '../config';

const OLA_API_BASE = 'https://api.olamaps.io';
const OLA_AUTH_URL = 'https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token';

type TokenCache = {
  token: string;
  expiresAtMs: number;
} | null;

let tokenCache: TokenCache = null;

type OlaSuggestion = {
  placeId: string;
  description: string;
  lat: number;
  lng: number;
};

function appendApiKey(url: string): string {
  if (!OLA_MAPS_API_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
}

async function getOAuthToken(): Promise<string | null> {
  if (!OLA_MAPS_CLIENT_ID || !OLA_MAPS_CLIENT_SECRET) return null;
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 15_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('scope', 'openid');
  body.append('client_id', OLA_MAPS_CLIENT_ID);
  body.append('client_secret', OLA_MAPS_CLIENT_SECRET);

  const res = await fetch(OLA_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const token = typeof json?.access_token === 'string' ? json.access_token : null;
  const expiresIn = Number(json?.expires_in);
  if (!token) return null;
  tokenCache = {
    token,
    expiresAtMs: now + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 45 * 60 * 1000),
  };
  return token;
}

async function withAuthHeaders(url: string): Promise<{ url: string; headers: Record<string, string> }> {
  const token = await getOAuthToken();
  if (token) {
    return { url, headers: { Authorization: `Bearer ${token}` } };
  }
  return { url: appendApiKey(url), headers: {} };
}

function validLatLng(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

export function isOlaMapsConfigured(): boolean {
  return OLA_MAPS_ENABLED;
}

export async function olaAutocomplete(
  input: string,
  location?: { lat: number; lng: number } | null,
): Promise<OlaSuggestion[]> {
  const q = input.trim();
  if (!q) return [];
  let url = `${OLA_API_BASE}/places/v1/autocomplete?input=${encodeURIComponent(q)}`;
  if (location && validLatLng(location.lat, location.lng)) {
    url += `&location=${location.lat},${location.lng}`;
  }
  const { url: finalUrl, headers } = await withAuthHeaders(url);
  const res = await fetch(finalUrl, { headers });
  if (!res.ok) return [];
  const json = await res.json();
  const arr = Array.isArray(json?.predictions) ? json.predictions : [];
  return arr
    .map((p: any) => {
      const lat = p?.geometry?.location?.lat;
      const lng = p?.geometry?.location?.lng;
      if (!validLatLng(lat, lng)) return null;
      return {
        placeId: String(p?.place_id || p?.reference || ''),
        description: String(p?.description || ''),
        lat,
        lng,
      } as OlaSuggestion;
    })
    .filter((x: OlaSuggestion | null): x is OlaSuggestion => Boolean(x))
    .slice(0, 6);
}

export async function olaGeocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = address.trim();
  if (!q) return null;
  const { url, headers } = await withAuthHeaders(
    `${OLA_API_BASE}/places/v1/geocode?address=${encodeURIComponent(q)}`,
  );
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  const first = Array.isArray(json?.geocodingResults) ? json.geocodingResults[0] : null;
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (!validLatLng(lat, lng)) return null;
  const label = first?.formatted_address || first?.name || q;
  return { lat, lng, label: String(label) };
}

export async function olaDirectionsPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ polyline: string | null; etaMinutes: number | null }> {
  const { url, headers } = await withAuthHeaders(
    `${OLA_API_BASE}/routing/v1/directions?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`,
  );
  const res = await fetch(url, { method: 'POST', headers });
  if (!res.ok) return { polyline: null, etaMinutes: null };
  const json = await res.json();
  const route = Array.isArray(json?.routes) ? json.routes[0] : null;
  const polyline = typeof route?.overview_polyline === 'string' ? route.overview_polyline : null;
  const durationSec = Number(route?.legs?.[0]?.duration);
  const etaMinutes = Number.isFinite(durationSec) ? Math.max(1, Math.round(durationSec / 60)) : null;
  return { polyline, etaMinutes };
}
