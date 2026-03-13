import { Permission, PermissionsAndroid, Platform } from 'react-native';

async function requestAll(perms: Permission[]): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const results = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function ensureCameraPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perms = [PermissionsAndroid.PERMISSIONS.CAMERA];
  if (Platform.Version >= 33) {
    perms.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
  } else {
    perms.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  }
  return requestAll(perms);
}

export async function ensureGalleryPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perms = Platform.Version >= 33
    ? [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]
    : [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
  return requestAll(perms);
}
