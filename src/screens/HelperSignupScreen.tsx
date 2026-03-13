import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { Screen } from '../ui/Screen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { TextField } from '../ui/TextField';
import { Notice } from '../ui/Notice';
import { theme } from '../ui/theme';
import type { AuthStackParamList } from '../navigation/types';
import { ApiError } from '../api/http';
import { useI18n } from '../i18n/I18nProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'HelperSignup'>;

export function HelperSignupScreen({ navigation }: Props) {
  const { signupWithPassword } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()), [email]);
  const phoneOk = useMemo(() => phone.trim().length === 0 || /^\d{10}$/.test(phone.trim()), [phone]);
  const canSubmit = useMemo(() => emailOk && phoneOk && password.trim().length >= 6, [emailOk, password, phoneOk]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signupWithPassword(email.trim(), password.trim(), 'HELPER', phone.trim() || null, displayName.trim() || null);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || t('error.signup'));
      } else {
        setError(t('error.signup'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSubmit, displayName, email, password, phone, signupWithPassword, t]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.h1}>{t('signup.helper.title')}</Text>
          <Text style={styles.sub}>{t('signup.helper.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextField label={t('signup.email')} value={email} onChangeText={setEmail} placeholder={t('signup.email_placeholder')} />
          <TextField
            label={t('signup.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('signup.password_placeholder')}
            secureTextEntry
          />
          <TextField
            label={t('signup.phone_optional')}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('signup.phone_placeholder')}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('signup.display_name_optional')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('signup.display_name_placeholder')}
          />
        </View>

        <Notice kind="warning" text={t('signup.helper.kyc_notice')} />

        {error ? <Notice kind="danger" text={error} /> : null}
        {!emailOk && email.trim().length > 0 ? <Notice kind="warning" text={t('signup.email_invalid')} /> : null}
        {!phoneOk ? <Notice kind="warning" text={t('signup.phone_invalid')} /> : null}

        <View style={styles.footer}>
          <PrimaryButton label={t('login.sign_up')} onPress={onSubmit} disabled={!canSubmit} loading={busy} />
          <Text onPress={() => navigation.goBack()} style={styles.alt}>
            {t('signup.back_to_login')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 10, paddingTop: 8 },
  h1: { color: theme.colors.text, fontSize: 26, fontWeight: '900', letterSpacing: 0.2 },
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  form: { gap: 12 },
  footer: { gap: 12, paddingBottom: 6 },
  alt: { color: theme.colors.primary, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
});
