import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Segmented } from '../ui/Segmented';
import { theme } from '../ui/theme';
import { useI18n } from '../i18n/I18nProvider';
import { APP_DISPLAY_NAME, LOCKED_ROLE } from '../config';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelection'>;

export function RoleSelectionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();

  const goBuyer = useCallback(() => {
    navigation.navigate('Login', { role: 'BUYER' });
  }, [navigation]);

  const goHelper = useCallback(() => {
    navigation.navigate('Login', { role: 'HELPER' });
  }, [navigation]);

  useEffect(() => {
    if (!LOCKED_ROLE) return;
    navigation.replace('Login', { role: LOCKED_ROLE });
  }, [navigation]);

  if (LOCKED_ROLE) {
    return null;
  }

  return (
    <Screen style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: t('language.en') },
            { key: 'hi', label: t('language.hi') },
            { key: 'te', label: t('language.te') },
          ]}
        />
      </View>

      <View style={styles.brand}>
        <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
        <Text style={styles.title}>{APP_DISPLAY_NAME}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.actions}>
          <PrimaryButton label={t('role.book')} onPress={goBuyer} variant="accent" style={styles.bigBtn} />
          <PrimaryButton label={t('role.be')} onPress={goHelper} style={styles.bigBtn} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: theme.space.lg },
  header: { alignItems: 'flex-start' },
  brand: { alignItems: 'center', gap: 8 },
  logo: { width: 90, height: 90, borderRadius: 24 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.text },
  tagline: { color: theme.colors.muted, fontWeight: '700' },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    gap: theme.space.md,
    ...theme.shadow.card,
  },
  actions: { gap: theme.space.sm, marginTop: 4 },
  bigBtn: { height: 54, borderRadius: 18 },
});
