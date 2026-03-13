import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from './theme';

export function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <View style={styles.line} />
      <View style={[styles.line, styles.lineMid]} />
      <View style={styles.line} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.7 },
  line: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  lineMid: { width: 12 },
});
