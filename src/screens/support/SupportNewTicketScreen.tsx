import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { SupportTicketCategory } from '../../api/types';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<any, any>;

export function SupportNewTicketScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const online = useIsOnline();

  const [category, setCategory] = useState<SupportTicketCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => online && message.trim().length >= 10 && !busy, [busy, message, online]);

  const onCreate = useCallback(async () => {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await withAuth((t) =>
        api.createSupportTicket(t, {
          category,
          subject: subject.trim() || null,
          message: message.trim(),
        }),
      );
      navigation.replace('SupportTicket', { ticketId: res.id });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setError(t('support.create_error'));
    } finally {
      setBusy(false);
    }
  }, [canCreate, category, message, navigation, subject, t, withAuth]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
        <Text style={styles.h1}>{t('support.new_title')}</Text>
        <Text style={styles.spacer}> </Text>
      </View>

      {!online ? <Notice kind="warning" text={t('common.offline')} /> : null}
      <Notice kind="info" text={t('support.ai_notice')} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.section}>{t('support.category')}</Text>
        <Segmented
          value={category}
          options={[
            { key: 'PAYMENT', label: t('support.category_payment') },
            { key: 'SAFETY', label: t('support.category_safety') },
            { key: 'QUALITY', label: t('support.category_quality') },
            { key: 'OTHER', label: t('support.category_other') },
          ]}
          onChange={(v) => setCategory(v as SupportTicketCategory)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>{t('support.details')}</Text>
        <TextField
          label={t('support.subject_optional')}
          value={subject}
          onChangeText={setSubject}
          placeholder={t('support.subject_placeholder')}
        />
        <TextField
          label={t('support.message_label')}
          value={message}
          onChangeText={setMessage}
          placeholder={t('support.message_placeholder')}
          multiline
        />
      </View>

      <PrimaryButton label={t('support.create_ticket')} onPress={onCreate} disabled={!canCreate} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl, gap: theme.space.md },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  spacer: { color: 'transparent' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
});
