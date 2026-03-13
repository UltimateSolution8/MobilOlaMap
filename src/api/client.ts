import { API_BASE_URL } from '../config';
import { fetchJson } from './http';
import type {
  AuthResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  HelperProfile,
  LiveKycSession,
  VideoKycStartResponse,
  VideoKycStatusResponse,
  OtpStartResponse,
  SupportMessage,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketDetail,
  Task,
  TaskStatus,
  MeProfile,
  UserRole,
  PushTokenRequest,
} from './types';
import { ApiError } from './http';

function url(path: string) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function authHeaders(accessToken: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    h.Authorization = `Bearer ${accessToken}`;
  }
  return h;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTask(raw: any): Task {
  if (!raw || typeof raw !== 'object') return raw as Task;
  return {
    ...raw,
    timeMinutes: toNumber(raw.timeMinutes, 0),
    budgetPaise: toNumber(raw.budgetPaise, 0),
    lat: toNumber(raw.lat, 0),
    lng: toNumber(raw.lng, 0),
    arrivalSelfieLat: toOptionalNumber(raw.arrivalSelfieLat),
    arrivalSelfieLng: toOptionalNumber(raw.arrivalSelfieLng),
    completionSelfieLat: toOptionalNumber(raw.completionSelfieLat),
    completionSelfieLng: toOptionalNumber(raw.completionSelfieLng),
    buyerRating: toOptionalNumber(raw.buyerRating),
    helperRating: toOptionalNumber(raw.helperRating),
    helperAvgRating: toOptionalNumber(raw.helperAvgRating),
    helperCompletedCount: toOptionalNumber(raw.helperCompletedCount),
    buyerAvgRating: toOptionalNumber(raw.buyerAvgRating),
    buyerCompletedCount: toOptionalNumber(raw.buyerCompletedCount),
  } as Task;
}

export async function otpStart(phone: string, role: UserRole, channel?: string | null): Promise<OtpStartResponse> {
  return fetchJson(url('/api/v1/auth/otp/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, role, channel: channel ?? null }),
  });
}

export async function otpVerify(
  phone: string,
  otp: string,
  role: UserRole,
): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, role }),
  });
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function passwordLogin(email: string, password: string): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/password/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function passwordSignup(req: {
  email: string;
  password: string;
  phone?: string | null;
  displayName?: string | null;
  role: UserRole;
}): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/password/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function helperSetOnline(
  accessToken: string,
  online: boolean,
  lat?: number,
  lng?: number,
): Promise<void> {
  await fetchJson(url('/api/v1/helper/online'), {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ online, lat, lng }),
  });
}

export async function registerPushToken(accessToken: string, req: PushTokenRequest): Promise<void> {
  await fetchJson(url('/api/v1/notifications/token'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(req),
  });
}

export async function helperGetProfile(accessToken: string): Promise<HelperProfile> {
  return fetchJson(url('/api/v1/helper/profile'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function helperGetAvailableTasks(accessToken: string): Promise<Task[]> {
  const tasks = await fetchJson<Task[]>(url('/api/v1/tasks/available'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
}

export async function helperSubmitKyc(
  accessToken: string,
  req: {
    fullName: string;
    idNumber: string;
    idFront: { uri: string; name: string; type: string };
    idBack: { uri: string; name: string; type: string };
    selfie: { uri: string; name: string; type: string };
  },
): Promise<HelperProfile> {
  const body = new FormData();
  const appendFile = (field: string, file: { uri: string; name: string; type: string }) => {
    body.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  };
  body.append('fullName', req.fullName);
  body.append('idNumber', req.idNumber);
  appendFile('idFront', req.idFront);
  appendFile('idBack', req.idBack);
  appendFile('selfie', req.selfie);
  if (req.selfie?.uri) {
    body.append('selfieUri', req.selfie.uri);
  }

  const res = await fetch(url('/api/v1/helper/kyc/submit'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const message = parsed?.message || `Request failed (${res.status})`;
    throw new ApiError(message, { status: res.status, code: parsed?.code, details: parsed?.details });
  }
  return parsed as HelperProfile;
}

export async function helperStartVideoKyc(
  accessToken: string,
  docType: string,
): Promise<VideoKycStartResponse> {
  return fetchJson(url('/api/v1/helper/video-kyc/start'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ docType, consent: true }),
  });
}

export async function helperVideoKycUploaded(
  accessToken: string,
  kycId: string,
  payload: {
    s3Keys: { video: string; docFront: string; docBack?: string | null };
    durationSeconds?: number | null;
  },
): Promise<void> {
  await fetchJson(url(`/api/v1/helper/video-kyc/${kycId}/uploaded`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function helperVideoKycStatus(
  accessToken: string,
  kycId: string,
): Promise<VideoKycStatusResponse> {
  return fetchJson(url(`/api/v1/helper/video-kyc/${kycId}/status`), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function helperLiveKycSession(accessToken: string): Promise<LiveKycSession> {
  return fetchJson(url('/api/v1/helper/video-kyc/live'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function createTask(accessToken: string, req: CreateTaskRequest): Promise<CreateTaskResponse> {
  return fetchJson(url('/api/v1/tasks'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(req),
  });
}

export async function acceptTask(accessToken: string, taskId: string): Promise<Task> {
  const task = await fetchJson<Task>(url(`/api/v1/tasks/${taskId}/accept`), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  return normalizeTask(task);
}

export async function updateTaskStatus(
  accessToken: string,
  taskId: string,
  status: TaskStatus,
  otp?: string | null,
): Promise<Task> {
  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchPromise = (async () => {
    const res = await fetch(url(`/api/v1/tasks/${taskId}/status`), {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ status, otp: otp ?? null }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message = parsed?.message || `Request failed (${res.status})`;
      throw new ApiError(message, { status: res.status, code: parsed?.code, details: parsed?.details });
    }
    return normalizeTask(parsed);
  })();
  const timeoutPromise = new Promise<Task>((_, reject) => {
    setTimeout(() => reject(new ApiError('Status update timed out. Please try again.', { status: 408 })), timeoutMs);
  });
  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    if (e && (e as { name?: string }).name === 'AbortError') {
      throw new ApiError('Status update timed out. Please try again.', { status: 408 });
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rateTask(
  accessToken: string,
  taskId: string,
  rating: number,
  comment?: string | null,
): Promise<Task> {
  const task = await fetchJson<Task>(url(`/api/v1/tasks/${taskId}/rating`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ rating, comment: comment ?? null }),
  });
  return normalizeTask(task);
}

export async function cancelTask(
  accessToken: string,
  taskId: string,
  reason: string,
): Promise<Task> {
  const task = await fetchJson<Task>(url(`/api/v1/tasks/${taskId}/cancel`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason }),
  });
  return normalizeTask(task);
}

export async function uploadTaskSelfie(
  accessToken: string,
  taskId: string,
  req: {
    stage: 'ARRIVAL' | 'COMPLETION';
    lat: number;
    lng: number;
    addressText?: string | null;
    capturedAt?: string;
    selfie: { uri: string; name: string; type: string };
  },
): Promise<Task> {
  const body = new FormData();
  const appendFile = (field: string, file: { uri: string; name: string; type: string }) => {
    body.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  };
  body.append('stage', req.stage);
  body.append('lat', String(req.lat));
  body.append('lng', String(req.lng));
  if (req.addressText) body.append('addressText', req.addressText);
  if (req.capturedAt) body.append('capturedAt', req.capturedAt);
  appendFile('selfie', req.selfie);

  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchPromise = (async () => {
    const res = await fetch(url(`/api/v1/tasks/${taskId}/selfie`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message = parsed?.message || `Request failed (${res.status})`;
      throw new ApiError(message, { status: res.status, code: parsed?.code, details: parsed?.details });
    }
    return normalizeTask(parsed);
  })();
  const timeoutPromise = new Promise<Task>((_, reject) => {
    setTimeout(() => reject(new ApiError('Selfie upload timed out. Please try again.', { status: 408 })), timeoutMs);
  });
  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    if (e && (e as { name?: string }).name === 'AbortError') {
      throw new ApiError('Selfie upload timed out. Please try again.', { status: 408 });
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTask(accessToken: string, taskId: string): Promise<Task> {
  const task = await fetchJson<Task>(url(`/api/v1/tasks/${taskId}`), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  return normalizeTask(task);
}

export async function listMyTasks(accessToken: string): Promise<Task[]> {
  const tasks = await fetchJson<Task[]>(url('/api/v1/tasks/mine'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  return Array.isArray(tasks) ? tasks.map((t) => normalizeTask(t)) : [];
}

export async function getMe(accessToken: string): Promise<MeProfile> {
  return fetchJson(url('/api/v1/me'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function updateMe(accessToken: string, displayName: string): Promise<MeProfile> {
  return fetchJson(url('/api/v1/me'), {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ displayName }),
  });
}

export async function listSupportTickets(accessToken: string): Promise<SupportTicket[]> {
  return fetchJson(url('/api/v1/support/tickets'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function getSupportTicket(accessToken: string, ticketId: string): Promise<SupportTicketDetail> {
  return fetchJson(url(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function createSupportTicket(
  accessToken: string,
  req: { category: SupportTicketCategory; subject?: string | null; message: string; relatedTaskId?: string | null },
): Promise<SupportTicketDetail> {
  return fetchJson(url('/api/v1/support/tickets'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(req),
  });
}

export async function addSupportMessage(
  accessToken: string,
  ticketId: string,
  message: string,
): Promise<SupportMessage> {
  return fetchJson(url(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message }),
  });
}
