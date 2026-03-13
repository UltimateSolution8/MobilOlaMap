import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Task, TaskAssignedEvent, TaskStatusChangedEvent, TaskStatus } from '../../api/types';
import * as api from '../../api/client';
import { distanceMeters, decodePolyline } from '../../utils/geo';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { MenuButton } from '../../ui/MenuButton';
import { TextField } from '../../ui/TextField';
import { TaskSkeleton } from '../../ui/TaskSkeleton';
import { MemoizedMapView } from '../../ui/MemoizedMapView';
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION } from '../../config';
import type { BuyerStackParamList } from '../../navigation/types';
import { useActiveTask } from '../../state/ActiveTaskContext';
import { useI18n } from '../../i18n/I18nProvider';
import { isOlaMapsConfigured, olaDirectionsPolyline } from '../../maps/ola';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerTask'>;

export function BuyerTaskScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const socket = useSocket();
  const { setActiveTaskId } = useActiveTask();
  const { t } = useI18n();

  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helperLoc, setHelperLoc] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [ratingReady, setRatingReady] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const helperPhone = useMemo(() => {
    const raw = task?.helperPhone;
    if (typeof raw === 'string') return raw.trim();
    if (raw == null) return '';
    return String(raw);
  }, [task?.helperPhone]);
  const scheduledAtLabel = useMemo(() => {
    if (!task?.scheduledAt) return null;
    const dt = new Date(task.scheduledAt);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleString();
  }, [task?.scheduledAt]);
  const canRenderMap = isOlaMapsConfigured();

  const lastRouteFetch = useRef(0);
  const helperMarkerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const lastFitAt = useRef(0);
  const previousStatus = useRef<TaskStatus | null>(null);

  const taskLat = Number(task?.lat);
  const taskLng = Number(task?.lng);
  const hasTaskCoords = Number.isFinite(taskLat) && Number.isFinite(taskLng);
  const mapMarkers = useMemo(() => {
    const list: { key: string; coordinate: { latitude: number; longitude: number }; title?: string; ref?: any }[] = [];
    if (hasTaskCoords) {
      list.push({ key: 'buyer', coordinate: { latitude: taskLat, longitude: taskLng }, title: t('map.you') });
    }
    if (helperLoc) {
      list.push({
        key: 'helper',
        coordinate: { latitude: helperLoc.lat, longitude: helperLoc.lng },
        title: t('role.superherooo'),
        ref: helperMarkerRef,
      });
    }
    return list;
  }, [hasTaskCoords, taskLat, taskLng, helperLoc, t]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await withAuth((at) => api.getTask(at, taskId));
      setTask(t);
    } catch {
      setError(t('error.load_task'));
    } finally {
      setBusy(false);
      setInitialLoad(false);
    }
  }, [taskId, t, withAuth]);

  // Only useFocusEffect — fires on both mount + re-focus (fixes double load)
  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (!socket) return;
    socket.emit('task.subscribe', { taskId });

    const onAssigned = (evt: TaskAssignedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) =>
        prev ? { ...prev, status: evt.status, assignedHelperId: evt.helperId } : prev,
      );
    };

    const onStatus = (evt: TaskStatusChangedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) => (prev ? { ...prev, status: evt.status } : prev));
    };

    const onHelperLoc = (evt: { taskId: string; helperId: string; lat: number; lng: number; ts: number }) => {
      if (!evt || evt.taskId !== taskId) return;
      const nextLat = Number(evt.lat);
      const nextLng = Number(evt.lng);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
      setHelperLoc({ lat: nextLat, lng: nextLng, ts: evt.ts || Date.now() });
      const marker = helperMarkerRef.current;
      if (marker && typeof marker.animateMarkerToCoordinate === 'function' && Platform.OS === 'android') {
        marker.animateMarkerToCoordinate({ latitude: nextLat, longitude: nextLng }, 900);
      }
      if (hasTaskCoords && mapRef.current) {
        const now = Date.now();
        if (now - lastFitAt.current > 6_000) {
          lastFitAt.current = now;
          mapRef.current.fitToCoordinates(
            [
              { latitude: taskLat, longitude: taskLng },
              { latitude: nextLat, longitude: nextLng },
            ],
            { edgePadding: { top: 80, right: 60, bottom: 100, left: 60 }, animated: true },
          );
        }
      }
    };

    socket.on('task_assigned', onAssigned);
    socket.on('task_status_changed', onStatus);
    socket.on('helper.location', onHelperLoc);
    return () => {
      socket.off('task_assigned', onAssigned);
      socket.off('task_status_changed', onStatus);
      socket.off('helper.location', onHelperLoc);
    };
  }, [socket, taskId, hasTaskCoords, taskLat, taskLng]);

  useEffect(() => {
    if (!task || !helperLoc || !hasTaskCoords || !isOlaMapsConfigured()) return;
    const now = Date.now();
    if (now - lastRouteFetch.current < 12_000) return;
    lastRouteFetch.current = now;

    const fetchRoute = async () => {
      try {
        const { polyline, etaMinutes } = await olaDirectionsPolyline(
          { lat: helperLoc.lat, lng: helperLoc.lng },
          { lat: taskLat, lng: taskLng },
        );
        if (polyline) {
          setRouteCoords(decodePolyline(polyline));
        }
        if (etaMinutes != null) {
          setRouteEtaMin(etaMinutes);
        }
      } catch {
        // best-effort
      }
    };

    fetchRoute();
  }, [helperLoc, task]);

  useEffect(() => {
    if (!mapRef.current || !hasTaskCoords) return;
    mapRef.current.animateToRegion(
      {
        latitude: taskLat,
        longitude: taskLng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      800,
    );
  }, [hasTaskCoords, taskLat, taskLng]);

  const onBackHome = useCallback(() => navigation.popToTop(), [navigation]);

  const status = task?.status ?? 'SEARCHING';
  const helperId = task?.assignedHelperId ?? null;
  const canCancel = status === 'SEARCHING' || status === 'ASSIGNED';

  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== 'COMPLETED' && status === 'COMPLETED') {
      setShowCelebration(true);
      setRatingReady(false);
    }
    previousStatus.current = status;
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      setActiveTaskId(null);
    }
  }, [setActiveTaskId, status]);

  useEffect(() => {
    if (status === 'COMPLETED' && !task?.buyerRating) {
      setRatingReady(true);
    }
  }, [status, task?.buyerRating]);
  const canDone = useMemo(() => status === 'COMPLETED', [status]);
  const helperDistance = useMemo(() => {
    if (!task || !helperLoc || !hasTaskCoords) return null;
    return distanceMeters({ lat: taskLat, lng: taskLng }, { lat: helperLoc.lat, lng: helperLoc.lng });
  }, [helperLoc, hasTaskCoords, task, taskLat, taskLng]);
  const helperEta = useMemo(() => {
    if (routeEtaMin != null) return routeEtaMin;
    if (!helperDistance) return null;
    const minutes = Math.max(1, Math.round(helperDistance / 60));
    return minutes;
  }, [helperDistance, routeEtaMin]);
  const helperLastSeen = useMemo(() => {
    if (!helperLoc?.ts) return null;
    const secs = Math.max(0, Math.floor((Date.now() - helperLoc.ts) / 1000));
    return secs;
  }, [helperLoc]);
  const helperArrived = useMemo(() => {
    if (helperDistance == null) return false;
    return helperDistance <= 60;
  }, [helperDistance]);

  const canRate = status === 'COMPLETED' && !task?.buyerRating;
  const submitRating = useCallback(async () => {
    if (!canRate || ratingBusy) return;
    setRatingBusy(true);
    setError(null);
    try {
      const updated = await withAuth((at) => api.rateTask(at, taskId, rating, ratingComment.trim() || null));
      setTask(updated);
    } catch {
      setError(t('error.submit_rating'));
    } finally {
      setRatingBusy(false);
    }
  }, [canRate, rating, ratingBusy, ratingComment, t, taskId, withAuth]);

  const submitCancel = useCallback(async () => {
    if (!canCancel || cancelBusy) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setError(t('buyer.task.please_cancel'));
      return;
    }
    setCancelBusy(true);
    setError(null);
    try {
      const updated = await withAuth((at) => api.cancelTask(at, taskId, reason));
      setTask(updated);
      setCancelReason('');
    } catch {
      setError(t('error.cancel_task'));
    } finally {
      setCancelBusy(false);
    }
  }, [canCancel, cancelBusy, cancelReason, t, taskId, withAuth]);

  if (initialLoad) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.topBar}>
          <MenuButton onPress={() => navigation.navigate('Menu')} />
          <Text style={styles.h1}>{t('task.title')}</Text>
          <View style={styles.topActions} />
        </View>
        <TaskSkeleton />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.contentWrap}>
        <View style={styles.topBar}>
          <MenuButton onPress={() => navigation.navigate('Menu')} />
          <Text style={styles.h1}>{t('task.title')}</Text>
          <View style={styles.topActions}>
            <Text onPress={load} style={styles.link}>{t('common.refresh')}</Text>
            <Text onPress={onBackHome} style={styles.link}>{t('common.back')}</Text>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {helperPhone ? (
            <View style={styles.contactRow}>
              <View>
                <Text style={styles.label}>{t('buyer.task.hero_label')}</Text>
                <Text style={styles.value}>{task?.helperName ?? helperPhone}</Text>
                <Text style={styles.value}>{helperPhone}</Text>
                {task?.helperAvgRating != null ? (
                  <Text style={styles.muted}>
                    {t('task.helper_rating')}: {task.helperAvgRating.toFixed(1)} / 5
                    {task.helperCompletedCount != null ? ` · ${task.helperCompletedCount} ${t('task.jobs_done')}` : ''}
                  </Text>
                ) : null}
              </View>
              <PrimaryButton
                label={t('task.call_hero')}
                onPress={() => Linking.openURL(`tel:${helperPhone}`)}
                variant="ghost"
                style={styles.callButton}
              />
            </View>
          ) : null}

          {error ? <Notice kind="danger" text={error} /> : null}

          {canRenderMap ? (
            <MemoizedMapView
              mapRef={mapRef}
              markers={mapMarkers}
              routeCoords={routeCoords}
              initialRegion={{
                latitude: hasTaskCoords ? taskLat : DEMO_FALLBACK_LOCATION?.lat ?? 12.9716,
                longitude: hasTaskCoords ? taskLng : DEMO_FALLBACK_LOCATION?.lng ?? 77.5946,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              height={220}
              style={styles.mapWrap}
            />
          ) : (
            <Notice kind="warning" text={t('error.maps_api_key')} />
          )}

          <View style={styles.liveCard}>
            <Text style={styles.liveTitle}>{t('task.hero_on_the_way')}</Text>
            <Text style={styles.liveSub}>{t('task.live_location')}</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveStat}>
                <Text style={styles.liveLabel}>{t('task.distance')}</Text>
                <Text style={styles.liveValue}>
                  {helperDistance == null ? '--' : `${(helperDistance / 1000).toFixed(2)} km`}
                </Text>
              </View>
              <View style={styles.liveStat}>
                <Text style={styles.liveLabel}>{t('task.eta_label')}</Text>
                <Text style={styles.liveValue}>{helperEta == null ? '--' : `${helperEta} min`}</Text>
              </View>
              <View style={styles.liveStat}>
                <Text style={styles.liveLabel}>{t('task.updated')}</Text>
                <Text style={styles.liveValue}>{helperLastSeen == null ? '--' : `${helperLastSeen}s`}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.status}>{status === 'SEARCHING' ? t('buyer.task.searching') : status === 'ASSIGNED' ? t('buyer.task.assigned') : status === 'ARRIVED' ? t('buyer.task.arrived') : status === 'STARTED' ? t('buyer.task.started') : status === 'COMPLETED' ? t('buyer.task.completed') : status === 'CANCELLED' ? t('buyer.task.cancelled') : status}</Text>
            {helperArrived ? <Notice kind="success" text={t('buyer.task.hero_arrived')} /> : null}
            {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
            {helperId ? (
              <Text style={styles.muted}>{t('buyer.task.hero_label')}: {task?.helperName ?? task?.helperPhone ?? t('buyer.task.assigned')}</Text>
            ) : null}
            {task?.addressText ? <Text style={styles.muted}>{t('buyer.address_optional')}: {task.addressText}</Text> : null}
            {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}
            {scheduledAtLabel ? <Text style={styles.muted}>{t('task.scheduled_for')}: {scheduledAtLabel}</Text> : null}
            <Text style={styles.muted}>{t('buyer.task.urgency')}: {task?.urgency ?? '-'} | {t('buyer.task.eta')}: {task?.timeMinutes ?? '-'} {t('buyer.task.minutes')}</Text>
            <Text style={styles.muted}>{t('buyer.task.budget')}: {t('currency.inr')} {task ? (task.budgetPaise / 100).toFixed(0) : '-'}</Text>
            {task?.arrivalOtp ? <Text style={styles.otp}>{t('buyer.task.arrival_otp')}: {task.arrivalOtp}</Text> : null}
            {task?.completionOtp ? <Text style={styles.otp}>{t('buyer.task.completion_otp')}: {task.completionOtp}</Text> : null}

            <PrimaryButton label={t('task.refresh')} onPress={load} loading={busy} variant="ghost" />

            {canCancel ? (
              <>
                <TextField
                  label={t('task.cancellation_reason')}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder={t('task.share_cancelling')}
                />
                <PrimaryButton
                  label={t('task.cancel_task')}
                  onPress={submitCancel}
                  loading={cancelBusy}
                  variant="danger"
                />
              </>
            ) : null}
          </View>

          {canDone ? <Notice kind="success" text={t('buyer.task.completed_notice')} /> : null}

          {status === 'COMPLETED' && ratingReady ? (
            <View style={styles.ratingCard}>
              <Text style={styles.liveTitle}>{t('task.rate_hero')}</Text>
              {task?.buyerRating ? (
                <Text style={styles.muted}>{t('task.your_rating')}: {task.buyerRating.toFixed(1)} / 5</Text>
              ) : (
                <>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <Text
                        key={`rate-${r}`}
                        style={[styles.star, r <= rating ? styles.starOn : styles.starOff]}
                        onPress={() => setRating(r)}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                  <TextField
                    label={t('task.comment_optional')}
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    placeholder={t('task.share_feedback')}
                  />
                  <PrimaryButton label={t('task.submit_rating')} onPress={submitRating} loading={ratingBusy} />
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>

      {showCelebration ? (
        <View style={styles.celebrateWrap}>
          <View style={styles.celebrateCard}>
            <Text style={styles.celebrateTitle}>{t('task.completed_title')}</Text>
            <Text style={styles.celebrateBody}>{t('task.rate_experience')}</Text>
            <PrimaryButton
              label={t('task.continue')}
              onPress={() => {
                setShowCelebration(false);
                setRatingReady(true);
              }}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl, position: 'relative' },
  contentWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: theme.space.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  contactRow: {
    marginTop: theme.space.sm,
    padding: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  label: { color: theme.colors.muted, fontSize: 11 },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  callButton: { paddingHorizontal: theme.space.md },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  status: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  desc: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  otp: { color: theme.colors.primary, fontSize: 14, fontWeight: '800', marginTop: 4 },
  liveCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.xs,
    ...theme.shadow.card,
  },
  mapWrap: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    height: 220,
  },
  map: { flex: 1 },
  liveTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  liveSub: { color: theme.colors.muted, fontSize: 12 },
  liveRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.sm },
  liveStat: { flex: 1, padding: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: '#EEF2FF' },
  liveLabel: { color: theme.colors.muted, fontSize: 11 },
  liveValue: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  ratingCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  ratingRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 24 },
  starOn: { color: theme.colors.accent },
  starOff: { color: theme.colors.border },
  celebrateWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 12, 22, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space.lg,
    zIndex: 10,
  },
  celebrateCard: {
    width: '100%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    padding: theme.space.lg,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  celebrateTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  celebrateBody: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
});
