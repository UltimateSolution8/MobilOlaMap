export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, opts: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit | undefined,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const retries = opts?.retries ?? 0;

  // Keep minimal request diagnostics in dev; in release this is stripped by Metro.
  const debug = typeof __DEV__ !== 'undefined' && __DEV__ === true;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (debug) console.log('[api] request', { url, method: init?.method || 'GET' });
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      const body = text ? safeJson(text) : null;
      if (!res.ok) {
        const errBody = asApiErrorBody(body);
        if (debug) console.log('[api] response error', { url, status: res.status, body });
        throw new ApiError(
          errBody?.message || `Request failed (${res.status})`,
          { status: res.status, code: errBody?.code, details: errBody?.details },
        );
      }
      if (debug) console.log('[api] response ok', { url, status: res.status });
      return body as T;
    } catch (e) {
      lastErr = e;
      if (debug) console.log('[api] request failed', { url, error: String(e) });
      // Don't retry aborts or auth failures.
      if (e && (e as { name?: string }).name === 'AbortError') break;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) break;
      if (attempt < retries) {
        await sleep(200 * Math.pow(2, attempt));
      }
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asApiErrorBody(body: unknown): { message?: string; code?: string; details?: unknown } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { message?: unknown; code?: unknown; details?: unknown };
  return {
    message: typeof b.message === 'string' ? b.message : undefined,
    code: typeof b.code === 'string' ? b.code : undefined,
    details: b.details,
  };
}
