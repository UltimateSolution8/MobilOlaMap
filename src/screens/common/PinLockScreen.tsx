import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

export function PinLockScreen() {
  const { verifyPin, signOut } = useAuth();
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.trim().length !== 4) {
      setError(t('pin.error_length'));
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await verifyPin(pin.trim());
    if (!ok) {
      setError(t('pin.error_incorrect'));
    }
    setBusy(false);
  };

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{t('pin.title')}</Text>
        <Text style={styles.subtitle}>{t('pin.subtitle')}</Text>
        <TextField
          label={t('pin.label')}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D+/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder={t('pin.placeholder')}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? t('pin.checking') : t('pin.unlock')} onPress={submit} disabled={busy} />
        <PrimaryButton label={t('menu.sign_out')} variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: theme.colors.muted, fontSize: 14 },
  error: { color: theme.colors.danger, fontWeight: '700' },
});
