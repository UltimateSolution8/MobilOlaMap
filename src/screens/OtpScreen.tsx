import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DEV_SHOW_OTP } from '../config';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { Notice } from '../ui/Notice';
import { theme } from '../ui/theme';
import type { AuthStackParamList } from '../navigation/types';
import { ApiError } from '../api/http';
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OtpScreen({ route, navigation }: Props) {
  const { verifyOtp } = useAuth();
  const { t } = useI18n();
  const { phone, role, devOtp } = route.params;

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canVerify = useMemo(() => otp.replace(/\\D+/g, '').length >= 4, [otp]);

  const onVerify = useCallback(async () => {
    if (!canVerify || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, otp.replace(/\\D+/g, ''), role);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(t('error.verify_otp'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canVerify, otp, phone, role, t, verifyOtp]);

  const onEdit = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>{t('otp.title')}</Text>
        <Text style={styles.sub}>
          {t('otp.subtitle')} +91 {phone}. {role === 'BUYER' ? t('login.need_help') : t('login.can_help')}.
        </Text>
        <Text onPress={onEdit} style={styles.link}>
          {t('otp.edit_phone')}
        </Text>
      </View>

      {DEV_SHOW_OTP && devOtp ? (
        <Notice kind="warning" text={`${t('otp.dev_label')} ${devOtp}`} />
      ) : null}

      <TextField
        label={t('otp.label')}
        value={otp}
        onChangeText={setOtp}
        placeholder={t('otp.placeholder')}
        keyboardType="number-pad"
        autoFocus
      />

      {error ? <Notice kind="danger" text={error} /> : null}

      <PrimaryButton label={t('otp.verify')} onPress={onVerify} disabled={!canVerify} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  h1: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: theme.colors.primary, fontWeight: '700' },
});
