import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import { API_BASE_URL, SOCKET_URL } from '../../config';
import type { BuyerStackParamList, HelperStackParamList, AuthStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList & AuthStackParamList, 'Diagnostics'>;

export function DiagnosticsScreen({ navigation }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ping = useCallback(async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/actuator/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        setError(`HTTP ${res.status} ${res.statusText}\n${text || t('diagnostics.empty_body')}`);
      } else {
        setResult(text || t('diagnostics.empty_body'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  }, [t]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('diagnostics.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>{t('common.back')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('diagnostics.api_base')}</Text>
        <Text style={styles.value}>{API_BASE_URL}</Text>
        <Text style={styles.label}>{t('diagnostics.socket_url')}</Text>
        <Text style={styles.value}>{SOCKET_URL}</Text>
        <Text style={styles.label}>{t('diagnostics.health_url')}</Text>
        <Text style={styles.value}>{`${API_BASE_URL.replace(/\/+$/, '')}/actuator/health`}</Text>
      </View>

      <PrimaryButton label={t('diagnostics.ping')} onPress={ping} loading={busy} />

      {result ? <Notice kind="success" text={result} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}
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
    gap: theme.space.xs,
    marginTop: theme.space.sm,
    marginBottom: theme.space.md,
    ...theme.shadow.card,
  },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
});
