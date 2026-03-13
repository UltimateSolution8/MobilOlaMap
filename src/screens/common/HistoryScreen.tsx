import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import * as api from '../../api/client';
import type { Task } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { SkeletonPlaceholder } from '../../ui/SkeletonPlaceholder';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'History'>;

/* ── Memoized row component ─────────────────────────────── */
type HistoryRowProps = {
  task: Task;
  onOpen: (taskId: string) => void;
};

export const HistoryRow = React.memo(
  function HistoryRow({ task, onOpen }: HistoryRowProps) {
    const { t } = useI18n();
    const onPress = useCallback(() => onOpen(task.id), [onOpen, task.id]);
    const statusLabel = useMemo(() => {
      switch (task.status) {
        case 'SEARCHING':
          return t('status.searching');
        case 'ASSIGNED':
          return t('status.assigned');
        case 'ARRIVED':
          return t('status.arrived');
        case 'STARTED':
          return t('status.started');
        case 'COMPLETED':
          return t('status.completed');
        case 'CANCELLED':
          return t('status.cancelled');
        default:
          return task.status;
      }
    }, [t, task.status]);
    return (
      <Pressable style={styles.row} onPress={onPress}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>{t('history.status')}: {statusLabel}</Text>
        <Text style={styles.meta}>{t('history.budget')}: {t('currency.inr')} {(task.budgetPaise / 100).toFixed(0)}</Text>
        {task.addressText ? <Text style={styles.meta}>{task.addressText}</Text> : null}
      </Pressable>
    );
  },
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.title === next.task.title &&
    prev.task.budgetPaise === next.task.budgetPaise &&
    prev.task.addressText === next.task.addressText,
);

/* ── Loading skeleton ────────────────────────────────────── */
function HistorySkeleton() {
  return (
    <View style={styles.card}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.row, { gap: 8 }]}>
          <SkeletonPlaceholder width="70%" height={16} />
          <SkeletonPlaceholder width="40%" height={12} />
          <SkeletonPlaceholder width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

/* ── Stable renderItem ───────────────────────────────────── */
const renderHistoryRow = ({ item, onOpen }: { item: Task; onOpen: (id: string) => void }) => (
  <HistoryRow task={item} onOpen={onOpen} />
);

export function HistoryScreen({ navigation }: Props) {
  const { user, withAuth } = useAuth();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await withAuth((t) => api.listMyTasks(t));
      setTasks(list || []);
    } catch {
      setError(t('history.load_error'));
    } finally {
      setBusy(false);
      setInitialLoad(false);
    }
  }, [t, withAuth]);

  // Only useFocusEffect — fires on both mount + re-focus (fixes double load)
  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const onOpen = useCallback(
    (taskId: string) => {
      if (!user) return;
      if (user.role === 'HELPER') {
        navigation.navigate('HelperTask', { taskId });
      } else {
        navigation.navigate('BuyerTask', { taskId });
      }
    },
    [navigation, user],
  );

  // Stable renderItem that doesn't create new closure per render
  const renderItem = useCallback(
    ({ item }: { item: Task }) => <HistoryRow task={item} onOpen={onOpen} />,
    [onOpen],
  );

  if (initialLoad) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Text style={styles.h1}>{t('history.title')}</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>
            {t('common.back')}
          </Text>
        </View>
        <HistorySkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>{t('history.title')}</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          {t('common.back')}
        </Text>
      </View>

      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <PrimaryButton label={t('common.refresh')} onPress={load} loading={busy} variant="ghost" />
        <FlatList
          data={tasks}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.muted}>{t('history.no_tasks')}</Text>}
        />
      </View>
    </Screen>
  );
}

const keyExtractor = (t: Task) => t.id;

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
  list: { gap: 10, paddingTop: 8 },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    backgroundColor: theme.colors.card,
    gap: 4,
  },
  title: { color: theme.colors.text, fontWeight: '800' },
  meta: { color: theme.colors.muted, fontSize: 12 },
  muted: { color: theme.colors.muted, textAlign: 'center', paddingVertical: 12 },
});
