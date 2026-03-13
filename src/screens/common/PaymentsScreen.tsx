import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import * as api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'Payments'>;

export function PaymentsScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const [balancePaise, setBalancePaise] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await withAuth((t) => api.getMe(t));
      setBalancePaise(me.demoBalancePaise ?? 0);
    } catch {
      setError(t('payments.load_error'));
    } finally {
      setBusy(false);
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

  const balance = balancePaise != null ? (balancePaise / 100).toFixed(0) : '-';
  const title = t('payments.wallet_title');

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{title}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
      </View>

      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>{t('payments.demo_balance')}</Text>
        <Text style={styles.amount}>{t('currency.inr')} {balance}</Text>
        <Text style={styles.muted}>
          {t('payments.escrow_note')}
        </Text>
        <PrimaryButton label={t('common.refresh')} onPress={load} loading={busy} variant="ghost" />
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
  amount: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
