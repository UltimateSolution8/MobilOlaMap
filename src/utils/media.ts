import type { Asset } from 'react-native-image-picker';
import * as FileSystem from 'expo-file-system';

export type PickedFile = { uri: string; name: string; type: string };

const normalizeUri = (uri: string) => {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `file://${uri}`;
};

export const assetToPickedFile = (asset: Asset | null | undefined, fallbackName: string): PickedFile | null => {
  if (!asset) return null;
  const uri = normalizeUri((asset as any).fileCopyUri || asset.uri || '');
  if (!uri) return null;
  return {
    uri,
    name: asset.fileName || fallbackName,
    type: asset.type || 'image/jpeg',
  };
};

const isNonFileUri = (uri: string) =>
  uri.startsWith('content://') || uri.startsWith('ph://') || uri.startsWith('assets-library://');

const guessExt = (nameOrUri: string) => {
  const match = nameOrUri.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
};

export async function ensureLocalFileUri(uri: string, fallbackName: string): Promise<string> {
  if (!uri) return uri;
  if (uri.startsWith('file://')) return uri;
  if (isNonFileUri(uri)) {
    const fsAny = FileSystem as any;
    const baseDir = fsAny.cacheDirectory || fsAny.documentDirectory;
    if (!baseDir) return uri;
    const ext = guessExt(fallbackName);
    const target = `${baseDir}selfie-${Date.now()}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: target });
      return target;
    } catch {
      try {
        const data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        await FileSystem.writeAsStringAsync(target, data, { encoding: 'base64' as any });
        return target;
      } catch {
        return uri;
      }
    }
  }
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}
