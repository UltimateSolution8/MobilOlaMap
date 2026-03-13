import React, { memo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from './theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
};

export const TextField = memo(function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoFocus,
  multiline,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 12,
    color: theme.colors.muted,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: '#F9FBFF',
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
