import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Asset } from 'react-native-image-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Task, TaskStatus, TaskStatusChangedEvent } from '../../api/types';
import * as api from '../../api/client';
import { distanceMeters, decodePolyline } from '../../utils/geo';
import { useAuth } from '../../auth/AuthContext';
import { useSocket } from '../../realtime/SocketProvider';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { TextField } from '../../ui/TextField';
import { MenuButton } from '../../ui/MenuButton';
import { TaskSkeleton } from '../../ui/TaskSkeleton';
import { MemoizedMapView } from '../../ui/MemoizedMapView';
import { theme } from '../../ui/theme';
import { ensureCameraPermissions, ensureGalleryPermissions } from '../../utils/permissions';
import { assetToPickedFile, ensureLocalFileUri } from '../../utils/media';
import { enqueueUpload } from '../../utils/uploadQueue';
import { API_BASE_URL, ENABLE_PRESIGNED_SELFIES } from '../../config';
import type { HelperStackParamList } from '../../navigation/types';
import { DEMO_FALLBACK_LOCATION } from '../../config';
import { useActiveTask } from '../../state/ActiveTaskContext';
import { useI18n } from '../../i18n/I18nProvider';
import { useHelperPresence } from '../../state/HelperPresenceContext';
import { isOlaMapsConfigured, olaDirectionsPolyline } from '../../maps/ola';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperTask'>;

function nextStatus(s: TaskStatus): TaskStatus | null {
  if (s === 'ASSIGNED') return 'ARRIVED';
  if (s === 'ARRIVED') return 'STARTED';
  if (s === 'STARTED') return 'COMPLETED';
  return null;
}

const ArrivalOtpForm = React.memo(function ArrivalOtpForm({ onSubmit, busy, load }: { onSubmit: (otp: string) => void; busy: boolean; load: () => void }) {
  const { t } = useI18n();
  const [otp, setOtp] = useState('');
  return (
    <View style={styles.formWrap}>
      <Text style={styles.muted}>{t('helper.task.arrival_otp_title')}</Text>
      <Text style={styles.otpHint}>{t('helper.task.arrival_otp_hint')}</Text>
      <TextField
        label={t('helper.task.arrival_otp_label')}
        value={otp}
        onChangeText={setOtp}
        placeholder={t('helper.task.arrival_otp_placeholder')}
        keyboardType="number-pad"
      />
      <View style={styles.actions}>
        <PrimaryButton label={t('common.refresh')} onPress={load} variant="ghost" style={styles.half} />
        <PrimaryButton label={t('helper.task.start_work')} onPress={() => onSubmit(otp)} loading={busy} disabled={busy || otp.length < 4} style={styles.half} />
      </View>
    </View>
  );
});

const CompletionOtpForm = React.memo(function CompletionOtpForm({
  onSubmit,
  busy,
  load,
  completionSelfieDone,
  uploadCompletionSelfie,
  completionSelfieBusy,
}: {
  onSubmit: (otp: string) => void;
  busy: boolean;
  load: () => void;
  completionSelfieDone: boolean;
  uploadCompletionSelfie: () => void;
  completionSelfieBusy: boolean;
}) {
  const { t } = useI18n();
  const [otp, setOtp] = useState('');
  return (
    <View style={styles.formWrap}>
      <Text style={styles.muted}>{t('helper.task.completion_title')}</Text>
      <Text style={styles.otpHint}>{t('helper.task.completion_hint')}</Text>
      <View style={{ marginBottom: 12 }}>
        <PrimaryButton
          label={completionSelfieDone ? t('helper.task.completion_selfie_done') : t('helper.task.upload_completion_selfie')}
          onPress={uploadCompletionSelfie}
          loading={completionSelfieBusy}
          disabled={completionSelfieDone}
          variant="ghost"
        />
      </View>
      <TextField
        label={t('helper.task.completion_otp_label')}
        value={otp}
        onChangeText={setOtp}
        placeholder={t('helper.task.completion_otp_placeholder')}
        keyboardType="number-pad"
      />
      <View style={styles.actions}>
        <PrimaryButton label={t('common.refresh')} onPress={load} variant="ghost" style={styles.half} />
        <PrimaryButton
          label={t('helper.task.mark_completed')}
          onPress={() => onSubmit(otp)}
          loading={busy}
          disabled={busy || !completionSelfieDone || otp.length < 4}
          style={styles.half}
        />
      </View>
    </View>
  );
});

export function HelperTaskScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { withAuth } = useAuth();
  const socket = useSocket();
  const { setActiveTaskId } = useActiveTask();
  const { lastCoords } = useHelperPresence();
  const { t } = useI18n();

  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helperLoc, setHelperLoc] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [ratingReady, setRatingReady] = useState(false);
  const [completionSelfieBusy, setCompletionSelfieBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const mountedRef = useRef(true);
  const busyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivalSelfieDone = Boolean(task?.arrivalSelfieUrl);
  const buyerPhone = useMemo(() => {
    const raw = task?.buyerPhone;
    if (typeof raw === 'string') return raw.trim();
    if (raw == null) return '';
    return String(raw);
  }, [task?.buyerPhone]);

  const advancingRef = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await withAuth((at) => api.getTask(at, taskId));
      if (mountedRef.current) {
        setTask(t);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(t('error.load_task'));
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setInitialLoad(false);
      }
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
    return () => {
      mountedRef.current = false;
      if (busyTimeoutRef.current) {
        clearTimeout(busyTimeoutRef.current);
        busyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    if (task?.buyerId) {
      socket.emit('task.subscribe', { taskId, buyerId: task.buyerId });
    } else {
      socket.emit('task.subscribe', { taskId });
    }

    const onStatus = (evt: TaskStatusChangedEvent) => {
      if (!evt || evt.taskId !== taskId) return;
      setTask((prev) => (prev ? { ...prev, status: evt.status } : prev));
    };
    socket.on('task_status_changed', onStatus);
    return () => {
      socket.off('task_status_changed', onStatus);
    };
  }, [socket, task?.buyerId, taskId]);

  const status = task?.status ?? 'ASSIGNED';
  const next = useMemo(() => nextStatus(status), [status]);
  const canCancel = status === 'ASSIGNED' || status === 'SEARCHING';
  const completionSelfieDone = Boolean(task?.completionSelfieUrl);
  const previousStatus = useRef<TaskStatus | null>(null);
  const statusLabel = useCallback(
    (s: TaskStatus) => {
      switch (s) {
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
          return s;
      }
    },
    [t],
  );

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

  const taskLat = Number(task?.lat);
  const taskLng = Number(task?.lng);
  const hasTaskCoords = Number.isFinite(taskLat) && Number.isFinite(taskLng);

  const helperDistance = useMemo(() => {
    if (!helperLoc || !hasTaskCoords) return null;
    return distanceMeters({ lat: helperLoc.lat, lng: helperLoc.lng }, { lat: taskLat, lng: taskLng });
  }, [helperLoc, hasTaskCoords, taskLat, taskLng]);

  const helperEta = useMemo(() => {
    if (routeEtaMin != null) return routeEtaMin;
    if (helperDistance == null) return null;
    return Math.max(1, Math.round(helperDistance / 60));
  }, [helperDistance, routeEtaMin]);

  const canRate = status === 'COMPLETED' && !task?.helperRating;
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
      setError(t('task.cancel_reason_required'));
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

  const safeSetState = useCallback((fn: () => void) => {
    if (mountedRef.current) {
      fn();
    }
  }, []);

  const pickSelfie = useCallback(async () => {
    const takeCamera = async (): Promise<Asset | null> => {
      try {
        const allowed = await ensureCameraPermissions();
        if (!allowed) {
          safeSetState(() => setError(t('error.camera_permission')));
          return null;
        }
        const res = await launchCamera({
          mediaType: 'photo',
          quality: 0.6,
          cameraType: 'front',
          saveToPhotos: false,
          includeExtra: true,
          maxWidth: 960,
          maxHeight: 960,
        });
        if (res.didCancel) return null;
        if (res.errorCode) {
          setError(t('error.camera_unavailable'));
          return null;
        }
        return res.assets?.[0] ?? null;
      } catch {
        setError(t('error.camera_unavailable'));
        return null;
      }
    };

    const pickGallery = async (): Promise<Asset | null> => {
      try {
        const allowed = await ensureGalleryPermissions();
        if (!allowed) {
          setError(t('error.gallery_permission'));
          return null;
        }
        const pick = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.6,
          selectionLimit: 1,
          includeExtra: true,
          maxWidth: 960,
          maxHeight: 960,
        });
        if (pick.didCancel) return null;
        if (pick.errorCode) {
          setError(t('error.gallery_unavailable'));
          return null;
        }
        return pick.assets?.[0] ?? null;
      } catch {
        setError(t('error.gallery_unavailable'));
        return null;
      }
    };

    const cameraAsset = await takeCamera();
    if (cameraAsset?.uri) return cameraAsset;

    return new Promise<Asset | null>((resolve) => {
      Alert.alert(
        t('helper.task.camera_unavailable_title'),
        t('helper.task.camera_unavailable_body'),
        [
          {
            text: t('common.choose_gallery'),
            onPress: async () => {
              const asset = await pickGallery();
              resolve(asset);
            },
          },
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
        ],
        { cancelable: true },
      );
    });
  }, [safeSetState, t]);

  const prepareSelfieFile = useCallback(
    async (asset: Asset, stage: 'ARRIVAL' | 'COMPLETION', requireJpeg: boolean) => {
      const base = assetToPickedFile(asset as any, `${stage.toLowerCase()}-selfie-${Date.now()}.jpg`);
      if (!base) return null;
      const localUri = await ensureLocalFileUri(base.uri, base.name);
      const baseFile = { ...base, uri: localUri };
      try {
        const processed = await manipulateAsync(
          localUri,
          [{ resize: { width: 960 } }],
          { compress: 0.7, format: SaveFormat.JPEG },
        );
        return {
          uri: processed.uri,
          name: base.name.replace(/\.\w+$/, '.jpg'),
          type: 'image/jpeg',
        };
      } catch {
        if (!requireJpeg) return baseFile;
        const isJpeg =
          baseFile.type?.includes('jpeg') ||
          baseFile.type?.includes('jpg') ||
          /\.jpe?g$/i.test(baseFile.name);
        return isJpeg ? { ...baseFile, type: 'image/jpeg', name: baseFile.name.replace(/\.\w+$/, '.jpg') } : null;
      }
    },
    [],
  );

  const uploadCheckpointSelfie = useCallback(
    async (stage: 'ARRIVAL' | 'COMPLETION') => {
      const a = await pickSelfie();
      if (!a || !a.uri) return false;

      safeSetState(() => setNotice(t('helper.task.processing_selfie')));
      // Direct multipart upload is the most stable path on Android.
      const selfie = await prepareSelfieFile(a, stage, false);
      if (!selfie) {
        setError(t('error.process_selfie'));
        return false;
      }

      let lat = task?.lat ?? 0;
      let lng = task?.lng ?? 0;
      let address = task?.addressText ?? '';

      const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
          let finished = false;
          const timer = setTimeout(() => {
            finished = true;
            reject(new Error('timeout'));
          }, ms);
          promise.then((v) => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              resolve(v);
            }
          }).catch((e) => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              reject(e);
            }
          });
        });
      };

      try {
        safeSetState(() => setNotice(t('helper.task.getting_location')));
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('Location permission missing');
        }
        const p = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          8000,
        );
        lat = p.coords.latitude;
        lng = p.coords.longitude;
        safeSetState(() => setNotice(t('helper.task.resolving_address')));
        const rev = await withTimeout(
          Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
          6000,
        );
        const first = rev[0];
        if (first) {
          const parts = [first.name, first.street, first.city, first.region, first.postalCode].filter(Boolean);
          address = parts.join(', ');
        }
      } catch {
        // best effort
      }

      try {
        const at = await withAuth((t) => Promise.resolve(t));
        safeSetState(() =>
          setNotice(stage === 'ARRIVAL' ? t('helper.task.queue_arrival_selfie') : t('helper.task.queue_completion_selfie')),
        );

        const directUpload = await enqueueUpload({
          id: `selfie-${taskId}-${stage}-${Date.now()}`,
          url: `${API_BASE_URL}/api/v1/tasks/${taskId}/selfie`,
          file: selfie,
          formFields: {
            stage,
            lat: String(lat),
            lng: String(lng),
            addressText: address,
            capturedAt: new Date().toISOString(),
          },
          accessToken: at,
        });

        let uploadSuccess = directUpload.success;
        if (!uploadSuccess && ENABLE_PRESIGNED_SELFIES) {
          // Optional fallback path retained for environments that prefer presigned upload.
          const presigned = await enqueueUpload(
            {
              type: 'presigned',
              id: `selfie-${taskId}-${stage}-${Date.now()}`,
              url: API_BASE_URL,
              file: selfie,
              formFields: {
                jobId: taskId,
                photoType: stage === 'ARRIVAL' ? 'arrival' : 'completion',
                lat: String(lat),
                lng: String(lng),
                addressText: address,
                capturedAt: new Date().toISOString(),
              },
              accessToken: at,
            },
            { enqueueOnFailure: false },
          );
          uploadSuccess = presigned.success;
          if (!uploadSuccess) {
            throw new Error(presigned.error || directUpload.error || t('error.upload_selfie'));
          }
        } else if (!uploadSuccess) {
          throw new Error(directUpload.error || t('error.upload_selfie'));
        }

        if (uploadSuccess && mountedRef.current) {
          // Unblock UI immediately; refresh task in background without blocking.
          const optimisticTask = {
            ...task,
            [stage === 'ARRIVAL' ? 'arrivalSelfieUrl' : 'completionSelfieUrl']: 'uploaded'
          } as Task;
          setTask(optimisticTask);
          safeSetState(() => setNotice(null));
          void (async () => {
            try {
              const refreshed = await withAuth((at) => api.getTask(at, taskId));
              if (mountedRef.current) {
                setTask(refreshed);
              }
            } catch {
              // keep optimistic state
            }
          })();
        }
        return uploadSuccess;
      } catch (err) {
        safeSetState(() => {
          if (err instanceof Error && err.message) {
            setError(err.message);
          } else {
            setError(t('error.upload_selfie'));
          }
        });
        return false;
      }
    },
    [prepareSelfieFile, safeSetState, t, task, taskId, withAuth],
  );

  const advance = useCallback(async (providedOtp?: string) => {
    if (!next || busy || advancingRef.current) return;
    advancingRef.current = true;
    if (busyTimeoutRef.current) {
      clearTimeout(busyTimeoutRef.current);
      busyTimeoutRef.current = null;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    busyTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setBusy(false);
      advancingRef.current = false;
      setError(t('error.upload_timeout'));
    }, 45_000);
    try {
      if (next === 'ARRIVED') {
        if (!arrivalSelfieDone) {
          const done = await uploadCheckpointSelfie('ARRIVAL');
          if (!done) {
            if (mountedRef.current) {
              setBusy(false);
              advancingRef.current = false;
            }
            return;
          }
        }
      }
      if (next === 'STARTED') {
        if (!providedOtp || !providedOtp.trim()) {
          if (mountedRef.current) {
            setError(t('error.arrival_otp_required'));
            setBusy(false);
            advancingRef.current = false;
          }
          return;
        }
      }
      if (next === 'COMPLETED') {
        // before we attempt to mark completed, make the selfie step just like ARRIVED
        if (!completionSelfieDone) {
          const done = await uploadCheckpointSelfie('COMPLETION');
          if (!done) {
            if (mountedRef.current) {
              setBusy(false);
              advancingRef.current = false;
            }
            return;
          }
          if (mountedRef.current) {
            setTask((prev) =>
              prev ? ({ ...prev, completionSelfieUrl: prev.completionSelfieUrl ?? 'uploaded' } as Task) : prev,
            );
            setNotice(t('error.completion_uploaded'));
            setTimeout(() => { if (mountedRef.current) setNotice(null); }, 2000);
          }
          void (async () => {
            try {
              const refreshed = await withAuth((at) => api.getTask(at, taskId));
              if (mountedRef.current) {
                setTask(refreshed);
              }
            } catch {
              // keep optimistic state
            }
          })();
        }
        if (!providedOtp || !providedOtp.trim()) {
          if (mountedRef.current) {
            setError(t('error.completion_otp_required'));
            setBusy(false);
            advancingRef.current = false;
          }
          return;
        }
      }

      const otp = providedOtp?.trim() || null;
      const updated = await withAuth((at) => api.updateTaskStatus(at, taskId, next, otp));
      if (mountedRef.current) {
        setTask(updated);
        setNotice(`${t('helper.task.status_updated')}: ${statusLabel(next)}`);
        setTimeout(() => { if (mountedRef.current) setNotice(null); }, 1500);
      }
    } catch (e) {
      if (mountedRef.current) {
        if (e instanceof Error && e.message) {
          setError(e.message);
        } else {
          setError(t('error.update_status'));
        }
      }
    } finally {
      if (busyTimeoutRef.current) {
        clearTimeout(busyTimeoutRef.current);
        busyTimeoutRef.current = null;
      }
      if (mountedRef.current) {
        setBusy(false);
        advancingRef.current = false;
      }
    }
  }, [arrivalSelfieDone, busy, completionSelfieDone, next, statusLabel, t, taskId, uploadCheckpointSelfie, withAuth]);
  const uploadCompletionSelfie = useCallback(async () => {
    if (completionSelfieBusy || completionSelfieDone) return;
    setCompletionSelfieBusy(true);
    setError(null);
    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      setCompletionSelfieBusy(false);
      setError(t('error.upload_timeout'));
    }, 45_000);
    try {
      const done = await uploadCheckpointSelfie('COMPLETION');
      if (!done) {
        if (mountedRef.current) setCompletionSelfieBusy(false);
        clearTimeout(timeout);
        return;
      }
      if (mountedRef.current) {
        setTask((prev) =>
          prev ? ({ ...prev, completionSelfieUrl: prev.completionSelfieUrl ?? 'uploaded' } as Task) : prev,
        );
        setNotice(t('error.completion_uploaded'));
        setTimeout(() => { if (mountedRef.current) setNotice(null); }, 2000);
      }
      void (async () => {
        try {
          const refreshed = await withAuth((at) => api.getTask(at, taskId));
          if (mountedRef.current) {
            setTask(refreshed);
          }
        } catch {
          // keep optimistic state
        }
      })();
    } catch {
      if (mountedRef.current) {
        setError(t('error.upload_selfie'));
      }
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) {
        setCompletionSelfieBusy(false);
      }
    }
  }, [completionSelfieBusy, completionSelfieDone, taskId, t, uploadCheckpointSelfie, withAuth]);

  const backHome = useCallback(() => navigation.popToTop(), [navigation]);

  const openMaps = useCallback(() => {
    if (!hasTaskCoords) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${taskLat},${taskLng}`,
      android: `https://maps.olakrutrim.com/?q=${taskLat},${taskLng}`,
    });
    if (url) {
      Linking.openURL(url);
    }
  }, [hasTaskCoords, taskLat, taskLng]);

  const shouldUpdateLoc = useCallback((nextLoc: { lat: number; lng: number; ts: number }) => {
    if (!helperLoc) return true;
    const dist = distanceMeters({ lat: helperLoc.lat, lng: helperLoc.lng }, { lat: nextLoc.lat, lng: nextLoc.lng });
    if (dist < 20 && Math.abs(nextLoc.ts - helperLoc.ts) < 15_000) return false;
    return true;
  }, [helperLoc]);

  useEffect(() => {
    if (!lastCoords) return;
    // Keep the map stable while OTP input is visible to avoid keyboard flicker.
    if (next === 'STARTED' || next === 'COMPLETED') return;
    const nextLoc = { lat: lastCoords.lat, lng: lastCoords.lng, ts: Date.now() };
    if (shouldUpdateLoc(nextLoc)) {
      setHelperLoc(nextLoc);
    }
  }, [lastCoords, next, shouldUpdateLoc]);

  const lastRouteFetch = useRef(0);
  useEffect(() => {
    if (next === 'STARTED' || next === 'COMPLETED') return;
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
          const points = decodePolyline(polyline);
          setRouteCoords(points);
        }
        if (etaMinutes != null) {
          setRouteEtaMin(etaMinutes);
        }
      } catch {
        // best effort
      }
    };
    fetchRoute();
  }, [helperLoc, hasTaskCoords, next, task, taskLat, taskLng]);

  const mapMarkers = useMemo(() => {
    const list = [];
    if (hasTaskCoords) {
      list.push({ key: 'customer', coordinate: { latitude: taskLat, longitude: taskLng }, title: t('role.citizen') });
    }
    if (helperLoc) {
      list.push({ key: 'helper', coordinate: { latitude: helperLoc.lat, longitude: helperLoc.lng }, title: t('map.you') });
    }
    return list;
  }, [hasTaskCoords, taskLat, taskLng, helperLoc, t]);

  if (initialLoad) {
    return (
      <Screen>
        <TaskHeader onMenu={() => navigation.navigate('Menu')} onRefresh={load} onBack={backHome} />
        <TaskSkeleton />
      </Screen>
    );
  }

  const showStickyFooter = !!next && next !== 'STARTED' && next !== 'COMPLETED';
  // when helper is entering an OTP we hide the map; it was causing layout
  // thrashing/keyboard flicker and even occasional crashes on older devices.
  const showMap = !(next === 'STARTED' || next === 'COMPLETED');

  return (
    <Screen style={styles.screenPaddingFix}>
      <TaskHeader onMenu={() => navigation.navigate('Menu')} onRefresh={load} onBack={backHome} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {buyerPhone ? (
          <CustomerContactCard
            buyerPhone={buyerPhone}
            name={task?.buyerName}
            avgRating={task?.buyerAvgRating}
            completedCount={task?.buyerCompletedCount}
          />
        ) : null}

        {notice ? <Notice kind="success" text={notice} /> : null}
        {error ? <Notice kind="danger" text={error} /> : null}

        {showMap ? (
          <MemoizedMapView
            markers={mapMarkers}
            routeCoords={routeCoords}
            initialRegion={{
              latitude: hasTaskCoords ? taskLat : DEMO_FALLBACK_LOCATION?.lat ?? 12.9716,
              longitude: hasTaskCoords ? taskLng : DEMO_FALLBACK_LOCATION?.lng ?? 77.5946,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            height={200}
          />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.status}>{statusLabel(status)}</Text>
          {task?.title ? <Text style={styles.title}>{task.title}</Text> : null}
          {task?.addressText ? <Text style={styles.muted}>{t('task.address')}: {task.addressText}</Text> : null}
          {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}
          <Text style={styles.muted}>
            {t('task.distance')}: {helperDistance == null ? '--' : `${(helperDistance / 1000).toFixed(2)} km`} • {t('task.eta_label')}{' '}
            {helperEta == null ? '--' : `${helperEta} ${t('helper.task.minutes')}`}
          </Text>
          <PrimaryButton label={t('task.open_maps')} onPress={openMaps} variant="ghost" />

          {next === 'STARTED' ? (
            <ArrivalOtpForm onSubmit={(o) => advance(o)} busy={busy} load={load} />
          ) : null}

          {next === 'COMPLETED' ? (
            <CompletionOtpForm
              onSubmit={(o) => advance(o)}
              busy={busy}
              load={load}
              completionSelfieDone={completionSelfieDone}
              uploadCompletionSelfie={uploadCompletionSelfie}
              completionSelfieBusy={completionSelfieBusy}
            />
          ) : null}

          {canCancel ? (
            <View style={styles.cancelBox}>
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
            </View>
          ) : null}

          {status === 'COMPLETED' && ratingReady ? (
            <RatingCard
              helperRating={task?.helperRating}
              rating={rating}
              setRating={setRating}
              ratingComment={ratingComment}
              setRatingComment={setRatingComment}
              submitRating={submitRating}
              ratingBusy={ratingBusy}
            />
          ) : null}
        </View>
      </ScrollView>

      {showStickyFooter ? (
        <View style={styles.stickyFooter}>
          <PrimaryButton
            label={`${t('helper.task.mark')} ${statusLabel(next as TaskStatus)}`}
            onPress={() => advance()}
            disabled={!next || ((next as TaskStatus) === 'COMPLETED' && !completionSelfieDone)}
            loading={busy}
            style={styles.stickyBtn}
          />
        </View>
      ) : null}

      {showCelebration ? (
        <CelebrationOverlay
          onContinue={() => {
            setShowCelebration(false);
            setRatingReady(true);
          }}
        />
      ) : null}
    </Screen>
  );
}

// Sub-components

const TaskHeader = memo(({ onMenu, onRefresh, onBack }: any) => {
  const { t } = useI18n();
  return (
    <View style={styles.topBar}>
      <MenuButton onPress={onMenu} />
      <Text style={styles.h1}>{t('helper.task.title')}</Text>
      <View style={styles.topActions}>
        <Text onPress={onRefresh} style={styles.link}>{t('common.refresh')}</Text>
        <Text onPress={onBack} style={styles.link}>{t('common.back')}</Text>
      </View>
    </View>
  );
});

const CustomerContactCard = memo(({ buyerPhone, name, avgRating, completedCount }: any) => {
  const { t } = useI18n();
  return (
    <View style={styles.contactRow}>
      <View style={styles.flex1}>
        <Text style={styles.label}>{t('role.citizen')}</Text>
        <Text style={styles.value}>{name ?? buyerPhone}</Text>
        <Text style={styles.value}>{buyerPhone}</Text>
        {avgRating != null ? (
          <Text style={styles.muted}>
            {t('task.rating')}: {avgRating.toFixed(1)} / 5
            {completedCount != null ? ` · ${completedCount} ${t('task.jobs_done')}` : ''}
          </Text>
        ) : null}
      </View>
      <PrimaryButton
        label={t('common.call')}
        onPress={() => Linking.openURL(`tel:${buyerPhone}`)}
        variant="ghost"
        style={styles.callButton}
      />
    </View>
  );
});

const RatingCard = memo(({ helperRating, rating, setRating, ratingComment, setRatingComment, submitRating, ratingBusy }: any) => {
  const { t } = useI18n();
  return (
    <View style={styles.ratingCard}>
      <Text style={styles.muted}>{t('helper.task.rate_citizen')}</Text>
      {helperRating ? (
        <Text style={styles.muted}>{t('task.your_rating')}: {helperRating.toFixed(1)} / 5</Text>
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
  );
});

const CelebrationOverlay = memo(({ onContinue }: any) => {
  const { t } = useI18n();
  return (
    <View style={styles.celebrateWrap}>
      <View style={styles.celebrateCard}>
        <Text style={styles.celebrateTitle}>{t('task.completed_title')}</Text>
        <Text style={styles.celebrateBody}>{t('helper.task.completed_body')}</Text>
        <PrimaryButton label={t('task.continue')} onPress={onContinue} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scrollContent: { gap: theme.space.md, paddingBottom: theme.space.xl, position: 'relative', minHeight: '100%' },
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
  mapWrap: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    height: 220,
  },
  map: { flex: 1 },
  card: {
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
  otpHint: { color: theme.colors.muted, fontSize: 12, marginBottom: 6 },
  formWrap: { padding: theme.space.md, gap: theme.space.sm, backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.space.md },
  actions: { flexDirection: 'row', gap: theme.space.sm, paddingTop: 8 },
  half: { flex: 1 },
  flex1: { flex: 1 },
  screenPaddingFix: { paddingBottom: 0 },
  stickyFooter: {
    padding: theme.space.lg,
    paddingTop: theme.space.sm,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  stickyBtn: { height: 50 },
  cancelBox: { marginTop: theme.space.md, gap: theme.space.sm, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.space.md },
  ratingCard: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    backgroundColor: theme.colors.card,
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
