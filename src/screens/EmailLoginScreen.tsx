import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
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
import { LOCKED_ROLE } from '../config';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailLogin'>;

export function EmailLoginScreen({ navigation }: Props) {
  const { loginWithPassword } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()), [email]);
  const canLogin = useMemo(() => emailOk && password.trim().length >= 6, [emailOk, password]);

  const onLogin = useCallback(async () => {
    if (!canLogin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(t('error.sign_in'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canLogin, email, loginWithPassword, password, t]);

  const onSignup = useCallback(() => {
    if (LOCKED_ROLE === 'BUYER') {
      navigation.navigate('BuyerSignup');
      return;
    }
    if (LOCKED_ROLE === 'HELPER') {
      navigation.navigate('HelperSignup');
      return;
    }
    Alert.alert(t('signup.choose_title'), t('signup.choose_subtitle'), [
      { text: t('role.citizen'), onPress: () => navigation.navigate('BuyerSignup') },
      { text: t('role.superherooo'), onPress: () => navigation.navigate('HelperSignup') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [navigation, t]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.h1}>{t('email.sign_in')}</Text>
          <Text style={styles.sub}>{t('email.subtitle')}</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>{t('email.back')}</Text>
        </View>

        <TextField
          label={t('signup.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('email.placeholder')}
          keyboardType="default"
        />

        <TextField
          label={t('signup.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('signup.password_placeholder')}
          secureTextEntry
        />

        {error ? <Notice kind="danger" text={error} /> : null}
        {!emailOk && email.trim().length > 0 ? <Notice kind="warning" text={t('signup.email_invalid')} /> : null}

        <PrimaryButton label={t('email.sign_in')} onPress={onLogin} disabled={!canLogin} loading={busy} />
        <View style={styles.signupRow}>
          <PrimaryButton label={t('login.sign_up')} variant="ghost" onPress={onSignup} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'space-between' },
  header: { gap: 10, paddingTop: 8 },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: theme.colors.primary, fontWeight: '800' },
  signupRow: { gap: 6, alignItems: 'center', paddingBottom: 6 },
});
