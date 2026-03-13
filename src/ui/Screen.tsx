import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from './theme';
import { ActiveTaskBubble } from './ActiveTaskBubble';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.inner, style, { paddingBottom: theme.space.lg + insets.bottom }]}>
        {children}
        <ActiveTaskBubble />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  inner: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
});
