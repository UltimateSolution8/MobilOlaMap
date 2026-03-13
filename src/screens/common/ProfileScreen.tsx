import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await withAuth((t) => api.getMe(t));
      setDisplayName(me.displayName ?? '');
      setPhone(me.phone ?? null);
      setEmail(me.email ?? null);
      setRole(me.role ?? '');
    } catch {
      setError(t('profile.load_error'));
    }
  }, [t, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const save = useCallback(async () => {
    if (!displayName.trim()) {
      setError(t('profile.name_required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withAuth((t) => api.updateMe(t, displayName.trim()));
      setNotice(t('profile.saved'));
      setTimeout(() => setNotice(null), 1500);
    } catch {
      setError(t('profile.update_error'));
    } finally {
      setBusy(false);
    }
  }, [displayName, t, withAuth]);

  const roleLabel = role === 'HELPER' ? t('role.superherooo') : role === 'BUYER' ? t('role.citizen') : role || '-';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('profile.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
      </View>

      {notice ? <Notice kind="success" text={notice} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t('profile.role')}</Text>
        <Text style={styles.value}>{roleLabel}</Text>

        <Text style={styles.label}>{t('profile.phone')}</Text>
        <Text style={styles.value}>{phone || '-'}</Text>

        <Text style={styles.label}>{t('profile.email')}</Text>
        <Text style={styles.value}>{email || '-'}</Text>

        <TextField label={t('profile.display_name')} value={displayName} onChangeText={setDisplayName} placeholder={t('profile.display_name_placeholder')} />
        <PrimaryButton label={t('common.save')} onPress={save} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
});
