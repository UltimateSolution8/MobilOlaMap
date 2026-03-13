/**
 * Upload queue with retry logic for resilient file uploads.
 * Queues failed uploads and retries with exponential backoff.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'superheroo.uploadQueue';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const UPLOAD_TIMEOUT_MS = 30_000;

export type UploadItem = {
    id: string;
    url: string;
    file: { uri: string; name: string; type: string };
    formFields: Record<string, string>;
    accessToken: string;
    retries: number;
    createdAt: number;
    type?: 'direct' | 'presigned';
};

export type UploadResult = {
    success: boolean;
    response?: any;
    error?: string;
};

async function loadQueue(): Promise<UploadItem[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: UploadItem[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptUpload(item: UploadItem): Promise<UploadResult> {
    const runWithTimeout = async (fn: (signal: AbortSignal) => Promise<UploadResult>): Promise<UploadResult> => {
        const controller = new AbortController();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<UploadResult>((resolve) => {
            timeoutId = setTimeout(() => {
                controller.abort();
                resolve({ success: false, error: 'Upload timed out. Please try again.' });
            }, UPLOAD_TIMEOUT_MS);
        });
        try {
            return await Promise.race([fn(controller.signal), timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    if (item.type === 'presigned') {
        return runWithTimeout(async (signal) => {
            try {
                // 1. Request presigned URL
                const reqRes = await fetch(`${item.url}/api/v1/photos/request-upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${item.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jobId: item.formFields.jobId,
                        photoType: item.formFields.photoType
                    }),
                    signal
                });

                if (!reqRes.ok) {
                    const text = await reqRes.text();
                    return { success: false, error: 'Request presign failed: ' + text };
                }
                const presignedData = await reqRes.json();
                const { photoId, presignedUrl, uploadHeaders } = presignedData;

                // 2. Upload file to presigned URL using XMLHttpRequest
                // React Native's fetch().blob() does NOT work for local file URIs.
                // XMLHttpRequest supports sending {uri, type, name} objects natively.
                const putHeaders = { ...uploadHeaders } as Record<string, string>;
                if (!putHeaders['Content-Type'] && !putHeaders['content-type']) {
                    putHeaders['Content-Type'] = item.file.type || 'image/jpeg';
                }

                const putResult = await new Promise<{ ok: boolean; status: number }>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', presignedUrl);
                    for (const [k, v] of Object.entries(putHeaders)) {
                        xhr.setRequestHeader(k, v);
                    }
                    xhr.onload = () => {
                        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
                    };
                    xhr.onerror = () => reject(new Error('Network error during PUT upload'));
                    xhr.ontimeout = () => reject(new Error('PUT upload timed out'));
                    if (signal) {
                        signal.addEventListener('abort', () => xhr.abort());
                    }
                    // React Native XMLHttpRequest supports sending file URI objects directly
                    xhr.send({ uri: item.file.uri, type: item.file.type || 'image/jpeg', name: item.file.name || 'selfie.jpg' } as any);
                });

                if (!putResult.ok) {
                    return { success: false, error: 'PUT presigned failed: ' + putResult.status };
                }

                // 3. Confirm upload
                const lat = item.formFields.lat !== undefined ? Number(item.formFields.lat) : null;
                const lng = item.formFields.lng !== undefined ? Number(item.formFields.lng) : null;
                const addressText = item.formFields.addressText || null;
                const capturedAt = item.formFields.capturedAt || null;

                const confirmRes = await fetch(`${item.url}/api/v1/photos/confirm-upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${item.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        photoId,
                        lat: Number.isFinite(lat as number) ? lat : null,
                        lng: Number.isFinite(lng as number) ? lng : null,
                        addressText,
                        capturedAt
                    }),
                    signal
                });

                if (!confirmRes.ok) {
                    const text = await confirmRes.text();
                    return { success: false, error: 'Confirm failed: ' + text };
                }

                return { success: true, response: { message: 'Uploaded and confirmed' } };
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Presigned upload failed';
                return { success: false, error: msg };
            }
        });
    }

    return runWithTimeout(async (signal) => {
        const body = new FormData();
        for (const [key, value] of Object.entries(item.formFields)) {
            body.append(key, value);
        }
        body.append('selfie', {
            uri: item.file.uri,
            name: item.file.name,
            type: item.file.type,
        } as any);

        try {
            const res = await fetch(item.url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${item.accessToken}` },
                body,
                signal,
            });

            const text = await res.text();
            let parsed: any = null;
            try {
                parsed = text ? JSON.parse(text) : null;
            } catch {
                parsed = null;
            }

            if (!res.ok) {
                return { success: false, error: parsed?.message || `Upload failed (${res.status})` };
            }
            return { success: true, response: parsed };
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Upload failed';
            return { success: false, error: msg };
        }
    });
}

/**
 * Enqueue an upload with retry support.
 * Returns true if uploaded successfully immediately.
 * If it fails, it's added to the persistent queue for later retry.
 */
export async function enqueueUpload(
    item: Omit<UploadItem, 'retries' | 'createdAt'>,
    opts?: { enqueueOnFailure?: boolean },
): Promise<UploadResult> {
    const fullItem: UploadItem = {
        ...item,
        retries: 0,
        createdAt: Date.now(),
    };

    const result = await attemptUpload(fullItem);
    if (result.success) return result;

    if (opts?.enqueueOnFailure !== false) {
        // Queue for retry
        const queue = await loadQueue();
        queue.push(fullItem);
        await saveQueue(queue);
    }

    return result;
}

/**
 * Process any queued uploads with exponential backoff.
 * Call this on app foreground or network reconnect.
 */
export async function processQueue(): Promise<void> {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    const remaining: UploadItem[] = [];

    for (const item of queue) {
        if (item.retries >= MAX_RETRIES) continue; // Drop after max retries

        const delay = BASE_DELAY_MS * Math.pow(2, item.retries);
        await sleep(delay);

        const result = await attemptUpload(item);
        if (!result.success) {
            remaining.push({ ...item, retries: item.retries + 1 });
        }
    }

    await saveQueue(remaining);
}

/**
 * Get current queue size for debugging/UI.
 */
export async function getQueueSize(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
}

/**
 * Clear the entire upload queue.
 */
export async function clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
}
