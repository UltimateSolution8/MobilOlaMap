import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Voice from '@react-native-voice/voice';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TaskUrgency } from '../../api/types';
import * as api from '../../api/client';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { TextField } from '../../ui/TextField';
import { Notice } from '../../ui/Notice';
import { Segmented } from '../../ui/Segmented';
import { MenuButton } from '../../ui/MenuButton';
import { theme } from '../../ui/theme';
import { DEMO_FALLBACK_LOCATION } from '../../config';
import type { BuyerStackParamList } from '../../navigation/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useActiveTask } from '../../state/ActiveTaskContext';
import { isOlaMapsConfigured, olaAutocomplete, olaGeocode } from '../../maps/ola';

type Props = NativeStackScreenProps<BuyerStackParamList, 'BuyerHome'>;

const URGENCY_OPTIONS: { labelKey: string; key: TaskUrgency }[] = [
  { labelKey: 'urgency.low', key: 'LOW' },
  { labelKey: 'urgency.normal', key: 'NORMAL' },
  { labelKey: 'urgency.high', key: 'HIGH' },
  { labelKey: 'urgency.critical', key: 'CRITICAL' },
];

const SCHEDULE_OPTIONS = [
  { key: 'now', labelKey: 'schedule.now' },
  { key: 'later', labelKey: 'schedule.later' },
];

export function BuyerHomeScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();
  const { setActiveTaskId } = useActiveTask();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [addressText, setAddressText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [autoSearchBusy, setAutoSearchBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; description: string; lat: number; lng: number }>>([]);
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [budgetRupees, setBudgetRupees] = useState('150');
  const [urgency, setUrgency] = useState<TaskUrgency>('NORMAL');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRenderMap = isOlaMapsConfigured();
  const urgencyOptions = useMemo(
    () => URGENCY_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) })),
    [t],
  );
  const scheduleOptions = useMemo(
    () => SCHEDULE_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) })),
    [t],
  );

  const titleOk = useMemo(() => title.trim().length >= 3, [title]);
  const descOk = useMemo(() => description.trim().length >= 10, [description]);
  const timeOk = useMemo(() => Number.isFinite(Number(timeMinutes)) && Number(timeMinutes) >= 1, [timeMinutes]);
  const budgetOk = useMemo(() => Number.isFinite(Number(budgetRupees)) && Number(budgetRupees) >= 0, [budgetRupees]);
  const scheduledAt = useMemo(() => {
    if (scheduleMode !== 'later') return null;
    const dateMatch = scheduleDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = scheduleTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return null;
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() !== month - 1 ||
      dt.getDate() !== day ||
      dt.getHours() !== hour ||
      dt.getMinutes() !== minute
    ) {
      return null;
    }
    return dt;
  }, [scheduleDate, scheduleMode, scheduleTime]);
  const scheduleOk = useMemo(() => {
    if (scheduleMode !== 'later') return true;
    if (!scheduledAt) return false;
    return scheduledAt.getTime() > Date.now() + 60_000;
  }, [scheduleMode, scheduledAt]);
  const canCreate = useMemo(
    () => Boolean(online && titleOk && descOk && timeOk && budgetOk && scheduleOk && lat != null && lng != null),
    [budgetOk, descOk, lat, lng, online, scheduleOk, timeOk, titleOk],
  );

  const lastLocationTs = useRef<number>(0);
  const voiceActiveRef = useRef(false);
  const voiceResultsRef = useRef<Set<string>>(new Set());
  const lastSpeechTimeRef = useRef<number>(0);

  const resolveAddress = useCallback(async (latitude: number, longitude: number) => {
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev && rev.length > 0) {
        const first = rev[0];
        const parts = [first.name, first.street, first.city, first.region].filter(Boolean);
        if (parts.length > 0) {
          setAddressText(parts.join(', '));
        }
      }
    } catch {
      // Best-effort only.
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError(t('error.gps_unavailable'));
          return;
        }
        setLocError(t('error.location_unavailable'));
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (DEMO_FALLBACK_LOCATION) {
          setLat(DEMO_FALLBACK_LOCATION.lat);
          setLng(DEMO_FALLBACK_LOCATION.lng);
          setLocError(t('error.location_permission_fallback'));
          return;
        }
        setLocError(t('error.location_permission'));
        return;
      }

      try {
        const st = await Location.getProviderStatusAsync();
        if (st.locationServicesEnabled && st.gpsAvailable === false && st.networkAvailable === false) {
          await Location.enableNetworkProviderAsync();
        }
      } catch {
        // best effort
      }

      const now = Date.now();
      if (now - lastLocationTs.current < 4_000) return;
      lastLocationTs.current = now;

      const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 2_000 });
      if (last?.coords) {
        setLat(last.coords.latitude);
        setLng(last.coords.longitude);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string'
          ? (e as any).message
          : null;
      if (DEMO_FALLBACK_LOCATION) {
        setLat(DEMO_FALLBACK_LOCATION.lat);
        setLng(DEMO_FALLBACK_LOCATION.lng);
        setLocError(t('error.location_fallback'));
        return;
      }
      setLocError(msg ? `${t('error.location_failed')}: ${msg}` : t('error.network'));
    }
  }, [t]);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  useFocusEffect(
    useCallback(() => {
      refreshLocation();
      return undefined;
    }, [refreshLocation]),
  );

  useEffect(() => {
    let isMounted = true;

    Voice.onSpeechResults = (event) => {
      if (!isMounted) return;
      const text = event.value?.[0] ?? '';
      if (text && text.trim()) {
        const timestamp = Date.now();
        // Prevent duplicate results within same speech session
        if (timestamp - lastSpeechTimeRef.current < 2000) {
          // Check if we've already processed this exact text
          if (voiceResultsRef.current.has(text)) {
            return;
          }
          voiceResultsRef.current.add(text);
        } else {
          // New speech session - clear previous results
          voiceResultsRef.current.clear();
          voiceResultsRef.current.add(text);
          lastSpeechTimeRef.current = timestamp;
        }
        // Only append if it's genuinely new content
        setDescription((prev) => {
          const trimmedText = text.trim();
          if (!trimmedText) return prev;
          // Check if the new text is already at the end to avoid duplicates
          if (prev && prev.trim().endsWith(trimmedText)) {
            return prev;
          }
          return prev ? `${prev.trim()} ${trimmedText}` : trimmedText;
        });
      }
    };

    Voice.onSpeechPartialResults = (event) => {
      // Don't append partial results to avoid duplicates - only use final results
      // This callback is useful for showing interim results but we skip appending
    };

    Voice.onSpeechError = () => {
      if (!isMounted) return;
      setVoiceError(t('error.voice_failed'));
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
    };

    Voice.onSpeechEnd = () => {
      if (!isMounted) return;
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
    };

    return () => {
      isMounted = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [t]);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;
    if (!isOlaMapsConfigured()) {
      setError(t('error.maps_api_key'));
      return;
    }
    setSearchBusy(true);
    setError(null);
    try {
      const [fromAutocomplete] = await olaAutocomplete(searchQuery.trim(), lat != null && lng != null ? { lat, lng } : null);
      if (fromAutocomplete) {
        setLat(fromAutocomplete.lat);
        setLng(fromAutocomplete.lng);
        setAddressText(fromAutocomplete.description);
        setSuggestions([]);
        return;
      }

      const geocoded = await olaGeocode(searchQuery.trim());
      if (geocoded) {
        setLat(geocoded.lat);
        setLng(geocoded.lng);
        setAddressText(geocoded.label);
        setSuggestions([]);
      } else {
        setError(t('error.location_not_found'));
      }
    } catch {
      setError(t('error.network_check'));
    } finally {
      setSearchBusy(false);
    }
  }, [searchQuery, resolveAddress, t]);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!isOlaMapsConfigured()) return;
      setAutoSearchBusy(true);
      try {
        const preds = await olaAutocomplete(query, lat != null && lng != null ? { lat, lng } : null);
        setSuggestions(preds);
      } catch {
        setSuggestions([]);
      } finally {
        setAutoSearchBusy(false);
      }
    },
    [lat, lng],
  );

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const t = setTimeout(() => {
      fetchSuggestions(q);
    }, 350);
    return () => clearTimeout(t);
  }, [fetchSuggestions, searchQuery]);

  const selectSuggestion = useCallback(
    async (_placeId: string, description: string, selectedLat: number, selectedLng: number) => {
      if (!isOlaMapsConfigured()) return;
      setError(null);
      setSearchBusy(true);
      setSuggestions([]);
      setSearchQuery(description);
      try {
        setLat(selectedLat);
        setLng(selectedLng);
        setAddressText(description);
      } catch {
        setError(t('error.fetch_details'));
      } finally {
        setSearchBusy(false);
      }
    },
    [t],
  );

  const onCreate = useCallback(async () => {
    if (!canCreate || busy || lat == null || lng == null) return;
    setBusy(true);
    setError(null);
    try {
      if (scheduleMode === 'later' && !scheduleOk) {
        setError(t('schedule.invalid_datetime'));
        return;
      }
      const scheduledAtIso = scheduleMode === 'later' && scheduledAt ? scheduledAt.toISOString() : null;
      const res = await withAuth((t) =>
        api.createTask(t, {
          title: title.trim(),
          description: description.trim(),
          urgency,
          timeMinutes: Number(timeMinutes),
          budgetPaise: Math.round(Number(budgetRupees) * 100),
          lat,
          lng,
          addressText: addressText.trim() || null,
          scheduledAt: scheduledAtIso,
        }),
      );
      await setActiveTaskId(res.taskId);
      navigation.navigate('BuyerTask', { taskId: res.taskId });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      if (e instanceof ApiError) {
        setError(e.message || t('error.create_task'));
      } else {
        setError(t('error.create_task'));
      }
    } finally {
      setBusy(false);
    }
  }, [addressText, budgetRupees, busy, canCreate, description, lat, lng, navigation, scheduleMode, scheduleOk, scheduledAt, timeMinutes, title, urgency, withAuth, t]);

  const toggleVoice = useCallback(async () => {
    setVoiceError(null);
    if (voiceActiveRef.current) {
      await Voice.stop();
      setVoiceActive(false);
      voiceActiveRef.current = false;
      voiceResultsRef.current.clear();
      return;
    }
    try {
      // Clear previous results before starting new recording
      voiceResultsRef.current.clear();
      lastSpeechTimeRef.current = Date.now();
      await Voice.start('en-IN');
      setVoiceActive(true);
      voiceActiveRef.current = true;
    } catch {
      setVoiceError(t('error.voice_unavailable'));
      setVoiceActive(false);
      voiceActiveRef.current = false;
    }
  }, [t]);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: theme.space.xl * 3 + Math.max(insets.bottom, theme.space.lg) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <MenuButton onPress={() => navigation.navigate('Menu')} />
            <Text style={styles.h1}>{t('buyer.create_task')}</Text>
            <View style={styles.topLinks} />
          </View>

          {!online ? <Notice kind="warning" text={t('buyer.offline')} /> : null}
          {locError ? <Notice kind="warning" text={locError} /> : null}
          {error ? <Notice kind="danger" text={error} /> : null}
          {voiceError ? <Notice kind="danger" text={voiceError} /> : null}

          <View style={styles.card}>
            <Text style={styles.section}>{t('buyer.pickup_location')}</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <TextField
                label={t('buyer.search_location')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('buyer.search_location')}
              />
            </View>
            <PrimaryButton
              label={t('buyer.search')}
              onPress={searchLocation}
              loading={searchBusy}
              style={styles.searchBtn}
              leftIcon={<MaterialCommunityIcons name="magnify" size={18} color={theme.colors.primaryText} />}
            />
          </View>
          {autoSearchBusy ? <Text style={styles.muted}>{t('buyer.searching_suggestions')}</Text> : null}
          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={styles.suggestionRow}
                  onPress={() => selectSuggestion(s.placeId, s.description, s.lat, s.lng)}
                >
                  <Text style={styles.suggestionText}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {addressText ? (
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>{t('buyer.selected_address')}</Text>
              <Text style={styles.addressValue}>{addressText}</Text>
            </View>
          ) : null}

            {canRenderMap ? (
              <Notice kind="success" text="Ola Maps search is enabled. Select location from search suggestions." />
            ) : (
              <Notice kind="warning" text={t('error.maps_api_key')} />
            )}

            <Text style={styles.section}>{t('buyer.task_details')}</Text>
            <TextField label={t('buyer.task_name')} value={title} onChangeText={setTitle} placeholder={t('buyer.task_name_placeholder')} />
            <View style={styles.voiceRow}>
              <TextField
                label={t('buyer.description')}
                value={description}
                onChangeText={setDescription}
                placeholder={t('buyer.description_placeholder')}
                multiline
              />
              <PrimaryButton
                label={voiceActive ? t('buyer.voice_stop') : t('buyer.voice_start')}
                onPress={toggleVoice}
                variant="ghost"
                style={styles.voiceBtn}
                leftIcon={
                  <MaterialCommunityIcons
                    name={voiceActive ? 'microphone-off' : 'microphone'}
                    size={18}
                    color={theme.colors.primary}
                  />
                }
              />
            </View>
            <TextField label={t('buyer.expected_time')} value={timeMinutes} onChangeText={setTimeMinutes} keyboardType="number-pad" />
            <TextField label={t('buyer.budget')} value={budgetRupees} onChangeText={setBudgetRupees} keyboardType="number-pad" />
            <Text style={styles.section}>{t('schedule.title')}</Text>
            <Segmented options={scheduleOptions} value={scheduleMode} onChange={(v) => setScheduleMode(v as 'now' | 'later')} />
            {scheduleMode === 'later' ? (
              <View style={styles.scheduleWrap}>
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleField}>
                    <TextField
                      label={t('schedule.date_label')}
                      value={scheduleDate}
                      onChangeText={setScheduleDate}
                      placeholder={t('schedule.date_placeholder')}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.scheduleField}>
                    <TextField
                      label={t('schedule.time_label')}
                      value={scheduleTime}
                      onChangeText={setScheduleTime}
                      placeholder={t('schedule.time_placeholder')}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Text style={styles.muted}>{t('schedule.help')}</Text>
                {!scheduleOk && (scheduleDate.trim() || scheduleTime.trim()) ? (
                  <Text style={styles.scheduleError}>{t('schedule.invalid_datetime')}</Text>
                ) : null}
              </View>
            ) : null}
            <Segmented options={urgencyOptions} value={urgency} onChange={(v) => setUrgency(v as TaskUrgency)} />
            <TextField
              label={t('buyer.address_optional')}
              value={addressText}
              onChangeText={setAddressText}
              placeholder={t('buyer.address_placeholder')}
              multiline
            />

            <View
              style={[
                styles.actionsRow,
                { paddingBottom: Math.max(insets.bottom + theme.space.md, theme.space.lg), marginBottom: theme.space.md },
              ]}
            >
              <PrimaryButton label={t('buyer.refresh_location')} onPress={refreshLocation} variant="ghost" style={styles.half} />
              <PrimaryButton label={t('buyer.create_task_btn')} onPress={onCreate} disabled={!canCreate} loading={busy} style={styles.half} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  screen: { padding: 0, gap: 0 },
  scrollContent: { padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xl * 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  muted: { color: theme.colors.muted, fontSize: 12 },
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
  voiceRow: { gap: theme.space.xs },
  voiceBtn: { alignSelf: 'flex-start' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm },
  searchField: { flex: 1 },
  searchBtn: { alignSelf: 'flex-end' },
  mapWrap: { height: 200, borderRadius: theme.radius.md, overflow: 'hidden' },
  map: { flex: 1 },
  section: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.25 },
  suggestions: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: { color: theme.colors.text, fontSize: 14 },
  addressBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.space.sm,
    backgroundColor: '#F8FAFF',
    gap: 6,
  },
  addressLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
  addressValue: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  scheduleWrap: { gap: theme.space.xs },
  scheduleRow: { flexDirection: 'row', gap: theme.space.sm },
  scheduleField: { flex: 1 },
  scheduleError: { color: theme.colors.danger, fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: 8 },
  half: { flex: 1 },
});
