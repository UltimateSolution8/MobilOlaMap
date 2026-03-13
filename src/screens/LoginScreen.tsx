import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { Segmented } from '../ui/Segmented';
import { Notice } from '../ui/Notice';
import { theme } from '../ui/theme';
import type { AuthStackParamList } from '../navigation/types';
import { ApiError } from '../api/http';
import { useI18n } from '../i18n/I18nProvider';
import { APP_DISPLAY_NAME, LOCKED_ROLE } from '../config';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function normalizePhone(raw: string) {
  return raw.replace(/\\D+/g, '').slice(-10);
}

export function LoginScreen({ navigation, route }: Props) {
  const { startOtp, authNotice, clearAuthNotice } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [role, setRole] = useState<'BUYER' | 'HELPER'>(LOCKED_ROLE ?? route.params?.role ?? 'BUYER');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const canSend = useMemo(() => normalizePhone(phone).length === 10, [phone]);

  React.useEffect(() => {
    if (LOCKED_ROLE) {
      if (role !== LOCKED_ROLE) setRole(LOCKED_ROLE);
      return;
    }
    if (route.params?.role && route.params.role !== role) {
      setRole(route.params.role);
    }
  }, [route.params?.role, role]);

  const onSend = useCallback(async () => {
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    try {
      const p = normalizePhone(phone);
      const res = await startOtp(p, role, null);
      navigation.navigate('Otp', { phone: p, role, devOtp: res.otp ?? null });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || t('error.send_otp'));
      } else {
        setError(t('error.send_otp'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSend, navigation, phone, role, startOtp, t]);

  const onSendWithChannel = useCallback(
    async (channel: 'sms' | 'whatsapp' | 'call') => {
      if (!canSend || busy) return;
      setBusy(true);
      setError(null);
      try {
        const p = normalizePhone(phone);
        const res = await startOtp(p, role, channel);
        navigation.navigate('Otp', { phone: p, role, devOtp: res.otp ?? null });
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e.message || t('error.send_otp'));
        } else {
          setError(t('error.send_otp'));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, canSend, navigation, phone, role, startOtp, t],
  );

  const onSignup = useCallback(() => {
    const targetRole = LOCKED_ROLE ?? role;
    navigation.navigate(targetRole === 'BUYER' ? 'BuyerSignup' : 'HelperSignup');
  }, [navigation, role]);
  const authNoticeText = authNotice ? t(authNotice) : null;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
            <View style={styles.langRow}>
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
            <View style={styles.brandBlock}>
              <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
              <Text style={styles.h1}>{APP_DISPLAY_NAME}</Text>
              <Text style={styles.sub}>{t('app.tagline')}</Text>
            </View>
          </View>

          {!LOCKED_ROLE ? (
            <Segmented
              value={role}
              onChange={(v) => setRole(v as 'BUYER' | 'HELPER')}
              options={[
                { key: 'BUYER', label: t('login.need_help') },
                { key: 'HELPER', label: t('login.can_help') },
              ]}
            />
          ) : null}

          <TextField
            label={t('login.phone')}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('login.phone_placeholder')}
            keyboardType="phone-pad"
            autoFocus
          />

          {error ? <Notice kind="danger" text={error} /> : null}
          {authNoticeText ? <Notice kind="warning" text={authNoticeText} onClose={clearAuthNotice} /> : null}

          <View style={styles.footer}>
            <PrimaryButton label={t('login.send_otp')} onPress={onSend} disabled={!canSend} loading={busy} />
            <View style={styles.otpOptions}>
              <Text style={styles.otpLink} onPress={() => onSendWithChannel('whatsapp')}>
                {t('login.otp_whatsapp')}
              </Text>
              <Text style={styles.otpLink} onPress={() => onSendWithChannel('call')}>
                {t('login.otp_call')}
              </Text>
            </View>
            <PrimaryButton label={t('login.sign_up')} onPress={onSignup} variant="ghost" />
            <PrimaryButton label={t('login.sign_in')} onPress={() => navigation.navigate('EmailLogin')} variant="ghost" />
            <Text onPress={() => navigation.navigate('Diagnostics')} style={styles.alt}>
              {t('login.diagnostics')}
            </Text>
            <Text style={styles.legal}>{t('login.terms')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  scroll: { gap: theme.space.md },
  header: { gap: 12 },
  langRow: { alignItems: 'flex-start', marginBottom: 6 },
  brandBlock: { alignItems: 'center', gap: 6 },
  logo: { width: 72, height: 72, borderRadius: 20 },
  h1: { color: theme.colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  footer: { gap: 12, marginTop: 8 },
  otpOptions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  otpLink: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  alt: { color: theme.colors.primary, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
  legal: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
