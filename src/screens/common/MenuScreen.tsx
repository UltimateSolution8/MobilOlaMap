import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'Menu'>;

export function MenuScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();

  const items = useMemo(() => {
    if (!user) return [];
    const home = user.role === 'HELPER' ? 'HelperHome' : 'BuyerHome';
    return [
      { key: 'profile', label: t('menu.profile'), screen: 'Profile' },
      { key: 'tasks', label: t('menu.tasks'), screen: home },
      { key: 'history', label: t('menu.earnings'), screen: 'History' },
      { key: 'payment', label: t('menu.wallet'), screen: 'Payments' },
      { key: 'settings', label: t('menu.settings'), screen: 'Settings' },
      { key: 'support', label: t('menu.support'), screen: 'SupportTickets' },
      { key: 'sos', label: t('menu.sos'), screen: 'SOS' },
      { key: 'terms', label: t('menu.terms'), screen: 'Terms' },
      { key: 'diagnostics', label: t('menu.diagnostics'), screen: 'Diagnostics' },
    ] as const;
  }, [t, user]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('menu.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {user ? (
          <View style={styles.profileCard}>
            <Text style={styles.profileName}>{user.displayName || t('menu.default_name')}</Text>
            <Text style={styles.profileMeta}>
              {user.role === 'HELPER' ? t('role.superherooo') : t('role.citizen')} • {user.phone}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={styles.row}
              onPress={() => navigation.navigate(item.screen as any)}
            >
              <Text style={styles.rowText}>{item.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.row, styles.signOut]} onPress={() => signOut()}>
            <Text style={styles.signOutText}>{t('menu.sign_out')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.xs,
    ...theme.shadow.card,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    ...theme.shadow.card,
  },
  profileName: { color: theme.colors.text, fontWeight: '900', fontSize: 18 },
  profileMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { color: theme.colors.text, fontWeight: '700' },
  rowArrow: { color: theme.colors.muted, fontSize: 18, fontWeight: '700' },
  signOut: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: { color: theme.colors.danger, fontWeight: '800', textAlign: 'center' },
});
