import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { LiveKycSession, VideoKycStartResponse, VideoKycStatusResponse } from '../../api/types';
import type { HelperStackParamList } from '../../navigation/types';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/http';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { ensureCameraPermissions, ensureGalleryPermissions } from '../../utils/permissions';
import { assetToPickedFile } from '../../utils/media';
import { uploadToPresignedUrl } from '../../utils/upload';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperVideoKyc'>;

type PickedFile = { uri: string; name: string; type: string };

export function HelperVideoKycScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();

  const [liveSession, setLiveSession] = useState<LiveKycSession | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [docType, setDocType] = useState('AADHAAR');
  const [docFront, setDocFront] = useState<PickedFile | null>(null);
  const [docBack, setDocBack] = useState<PickedFile | null>(null);
  const [video, setVideo] = useState<PickedFile | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const [startRes, setStartRes] = useState<VideoKycStartResponse | null>(null);
  const [status, setStatus] = useState<VideoKycStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canUpload = useMemo(() => !!docFront && !!video, [docFront, video]);

  const pickDoc = useCallback(async (setter: (f: PickedFile) => void) => {
    try {
      const allowed = await ensureGalleryPermissions();
      if (!allowed) {
        setError(t('helper.kyc.gallery_permission'));
        return;
      }
      const pick = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        selectionLimit: 1,
        includeExtra: true,
        maxWidth: 1600,
        maxHeight: 1600,
      });
      if (pick.didCancel) return;
      if (pick.errorCode) {
        setError(t('helper.kyc.could_not_open_gallery'));
        return;
      }
      const a = pick.assets?.[0];
      const file = assetToPickedFile(a, `doc-${Date.now()}.jpg`);
      if (!file) {
        setError(t('helper.kyc.could_not_access_image'));
        return;
      }
      setter(file);
    } catch {
      setError(t('helper.kyc.could_not_open_gallery'));
    }
  }, [t]);

  const pickVideo = useCallback(async () => {
    setError(null);
    const allowed = await ensureCameraPermissions();
    if (!allowed) {
      setError(t('helper.kyc.camera_permission'));
      return;
    }
    const res = await launchCamera({
      mediaType: 'video',
      durationLimit: 20,
      videoQuality: 'low',
      cameraType: 'front',
      saveToPhotos: false,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      setError(t('helper.kyc.video_capture_failed'));
      return;
    }
    const a = res.assets?.[0];
    const file = assetToPickedFile(a, `video-${Date.now()}.mp4`);
    if (!file) {
      setError(t('helper.kyc.could_not_capture'));
      return;
    }
    setVideo(file);
    const dur = a?.duration ? Math.round(a.duration) : null;
    setVideoDuration(dur);
  }, [t]);

  const checkLiveSession = useCallback(async () => {
    if (liveBusy) return;
    setLiveBusy(true);
    setLiveError(null);
    try {
      const session = await withAuth((token) => api.helperLiveKycSession(token));
      setLiveSession(session);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setLiveSession(null);
        setLiveError(t('helper.live_kyc.none'));
      } else {
        setLiveError(t('helper.live_kyc.error'));
      }
    } finally {
      setLiveBusy(false);
    }
  }, [liveBusy, t, withAuth]);

  const joinLiveSession = useCallback(() => {
    if (!liveSession) return;
    navigation.navigate('HelperLiveKycCall', {
      appId: liveSession.appId,
      roomId: liveSession.roomId,
      token: liveSession.token,
      userId: liveSession.userId,
      userName: liveSession.userName || t('role.superherooo'),
    });
  }, [liveSession, navigation, t]);

  const startKyc = useCallback(async () => {
    const response = await withAuth((token) => api.helperStartVideoKyc(token, docType.trim() || 'AADHAAR'));
    setStartRes(response);
    setStatus({ id: response.id, status: response.status, createdAt: new Date().toISOString() });
    return response;
  }, [docType, withAuth]);

  const uploadAndSubmit = useCallback(async () => {
    if (busy) return;
    if (!docFront || !video) {
      setError(t('helper.kyc.video_requirements'));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const started = startRes ?? (await startKyc());
      await uploadToPresignedUrl(started.uploadUrls.video.url, video, 'video/mp4');
      await uploadToPresignedUrl(started.uploadUrls.docFront.url, docFront, 'image/jpeg');
      if (docBack) {
        await uploadToPresignedUrl(started.uploadUrls.docBack.url, docBack, 'image/jpeg');
      }
      await withAuth((token) =>
        api.helperVideoKycUploaded(token, started.id, {
          s3Keys: {
            video: started.uploadUrls.video.key,
            docFront: started.uploadUrls.docFront.key,
            docBack: docBack ? started.uploadUrls.docBack.key : null,
          },
          durationSeconds: videoDuration ?? undefined,
        }),
      );
      const refreshed = await withAuth((token) => api.helperVideoKycStatus(token, started.id));
      setStatus(refreshed);
      setSuccess(t('helper.kyc.video_submitted'));
    } catch (e: any) {
      setError(e?.message || t('helper.kyc.could_not_submit'));
    } finally {
      setBusy(false);
    }
  }, [busy, docBack, docFront, startKyc, startRes, t, video, videoDuration, withAuth]);

  const refreshStatus = useCallback(async () => {
    if (!startRes?.id) return;
    setBusy(true);
    try {
      const refreshed = await withAuth((token) => api.helperVideoKycStatus(token, startRes.id));
      setStatus(refreshed);
    } catch (e: any) {
      setError(e?.message || t('helper.kyc.status_failed'));
    } finally {
      setBusy(false);
    }
  }, [startRes?.id, t, withAuth]);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.topBar}>
          <Text style={styles.h1}>{t('helper.video_kyc.title')}</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>{t('helper.kyc.back')}</Text>
        </View>
        <Text style={styles.caption}>{t('helper.video_kyc.subtitle')}</Text>

        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>{t('helper.live_kyc.title')}</Text>
          <Text style={styles.caption}>{t('helper.live_kyc.subtitle')}</Text>
          {liveError ? <Notice kind="warning" text={liveError} /> : null}
          <PrimaryButton
            label={liveSession ? t('helper.live_kyc.join') : t('helper.live_kyc.check')}
            onPress={liveSession ? joinLiveSession : checkLiveSession}
            loading={liveBusy}
          />
          {liveSession ? (
            <Text style={styles.liveMeta}>
              {t('helper.live_kyc.status')}: {liveSession.status}
            </Text>
          ) : null}
        </View>

        {error ? <Notice kind="danger" text={error} /> : null}
        {success ? <Notice kind="success" text={success} /> : null}

        <Text style={styles.label}>{t('helper.kyc.id_number')}</Text>
        <TextInput
          value={docType}
          onChangeText={setDocType}
          placeholder={t('helper.kyc.doc_type_placeholder')}
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />

        <View style={styles.uploadRow}>
          <PrimaryButton
            label={docFront ? t('helper.video_kyc.doc_front_selected') : t('helper.video_kyc.doc_front')}
            onPress={() => pickDoc((f) => setDocFront(f))}
            variant="ghost"
          />
          <PrimaryButton
            label={docBack ? t('helper.video_kyc.doc_back_selected') : t('helper.video_kyc.doc_back')}
            onPress={() => pickDoc((f) => setDocBack(f))}
            variant="ghost"
          />
          <PrimaryButton
            label={video ? t('helper.video_kyc.video_selected') : t('helper.video_kyc.capture_video')}
            onPress={pickVideo}
            variant="ghost"
          />
        </View>

        <PrimaryButton
          label={t('helper.video_kyc.submit')}
          onPress={uploadAndSubmit}
          disabled={!canUpload}
          loading={busy}
        />

        {status ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{t('helper.video_kyc.status')}</Text>
            <Text style={styles.statusText}>{status.status}</Text>
            <PrimaryButton label={t('helper.video_kyc.refresh')} onPress={refreshStatus} variant="ghost" />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { flex: 1, padding: 20, gap: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  link: { color: theme.colors.primary, fontWeight: '700' },
  caption: { color: theme.colors.muted, marginBottom: 8 },
  liveCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.card,
    gap: 8,
  },
  liveTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  liveMeta: { color: theme.colors.muted, fontSize: 12 },
  label: { color: theme.colors.text, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    padding: 12,
    borderRadius: 10,
  },
  uploadRow: { gap: 10, marginVertical: 12 },
  statusCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.colors.card,
    gap: 6,
  },
  statusTitle: { color: theme.colors.muted, fontWeight: '600' },
  statusText: { color: theme.colors.text, fontWeight: '700' },
});
