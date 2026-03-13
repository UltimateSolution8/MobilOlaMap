import { PickedFile } from './media';

export async function uploadToPresignedUrl(url: string, file: PickedFile, contentType?: string) {
  const fileRes = await fetch(file.uri);
  if (!fileRes.ok) {
    throw new Error('Could not read selected file');
  }
  const blob = await fileRes.blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType || file.type || 'application/octet-stream',
    },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}
