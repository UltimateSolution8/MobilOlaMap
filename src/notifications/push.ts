import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as api from '../api/client';

const STORAGE_KEY = 'superheroo.pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(accessToken: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Tasks',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;
    if (!token) return;

    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached === token) return;

    await api.registerPushToken(accessToken, { token, platform: Platform.OS });
    await AsyncStorage.setItem(STORAGE_KEY, token);
  } catch {
    // best-effort
  }
}
