import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import * as api from '../../api/client';
import type { SupportMessage, SupportTicketDetail } from '../../api/types';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { TextField } from '../../ui/TextField';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<any, any>;

function MsgRow({ item }: { item: SupportMessage }) {
  return (
    <View style={styles.msg}>
      <View style={styles.msgTop}>
        <Text style={styles.msgAuthor}>{item.authorType}</Text>
        <Text style={styles.msgTime}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <Text style={styles.msgBody}>{item.message}</Text>
    </View>
  );
}

export function SupportTicketScreen({ navigation, route }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const online = useIsOnline();
  const ticketId = String(route.params?.ticketId || '');

  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await withAuth((t) => api.getSupportTicket(t, ticketId));
      setTicket(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setError(t('support.ticket_load_error'));
    } finally {
      setLoading(false);
    }
  }, [t, ticketId, withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const canSend = useMemo(() => online && reply.trim().length >= 2 && !sending, [online, reply, sending]);

  const onSend = useCallback(async () => {
    if (!canSend || !ticketId) return;
    setSending(true);
    setError(null);
    try {
      const msg = await withAuth((t) => api.addSupportMessage(t, ticketId, reply.trim()));
      setReply('');
      // Optimistic append + refresh ticket meta.
      setTicket((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setError(t('support.message_send_error'));
    } finally {
      setSending(false);
    }
  }, [canSend, load, reply, t, ticketId, withAuth]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
        <Text style={styles.h1}>{ticket?.subject ?? t('support.ticket_title')}</Text>
        <Text onPress={load} style={styles.link}>
          {t('common.refresh')}
        </Text>
      </View>

      {!online ? <Notice kind="warning" text={t('common.offline')} /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      {ticket ? (
        <View style={styles.metaRow}>
          <Text style={styles.pill}>{ticket.category}</Text>
          <Text style={styles.pill}>{ticket.status}</Text>
        </View>
      ) : null}

      <FlatList
        data={ticket?.messages ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MsgRow item={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>{loading ? t('common.loading') : t('support.no_messages')}</Text>}
        initialNumToRender={12}
        windowSize={8}
        removeClippedSubviews
      />

      <View style={styles.replyCard}>
        <TextField label={t('support.reply_label')} value={reply} onChangeText={setReply} placeholder={t('support.reply_placeholder')} multiline />
        <PrimaryButton label={t('common.send')} onPress={onSend} disabled={!canSend} loading={sending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl, gap: theme.space.md },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'center' },
  link: { color: theme.colors.primary, fontWeight: '800', width: 72 },
  metaRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  pill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  list: { gap: 10, paddingBottom: 10 },
  muted: { color: theme.colors.muted, textAlign: 'center', marginTop: 12 },
  msg: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 8,
  },
  msgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgAuthor: { color: theme.colors.text, fontWeight: '900', fontSize: 12 },
  msgTime: { color: theme.colors.muted, fontSize: 11 },
  msgBody: { color: theme.colors.text, lineHeight: 20 },
  replyCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
});
