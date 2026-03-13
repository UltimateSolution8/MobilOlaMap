import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HelperStackParamList } from '../../navigation/types';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperLiveKycCall'>;

export function HelperLiveKycCallScreen({ route }: Props) {
  const { appId, roomId, token, userId, userName } = route.params;

  const injected = useMemo(() => {
    const payload = {
      appId,
      roomId,
      token,
      userId,
      userName,
      role: 'helper',
    };
    return `window.__LIVE_KYC__ = ${JSON.stringify(payload)}; true;`;
  }, [appId, roomId, token, userId, userName]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.wrap}>
        <WebView
          source={{ uri: 'https://mysuperhero.xyz/kyc/live/join' }}
          injectedJavaScriptBeforeContentLoaded={injected}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          style={styles.web}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { flex: 1 },
  web: { flex: 1, backgroundColor: Platform.OS === 'android' ? theme.colors.bg : undefined },
});
