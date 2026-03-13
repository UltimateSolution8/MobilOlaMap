import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import * as api from '../../api/client';
import { ApiError } from '../../api/http';
import type { HelperStackParamList } from '../../navigation/types';
import { useAuth } from '../../auth/AuthContext';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { ensureCameraPermissions, ensureGalleryPermissions } from '../../utils/permissions';
import { assetToPickedFile } from '../../utils/media';
import type { HelperProfile } from '../../api/types';
import { useI18n } from '../../i18n/I18nProvider';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperKyc'>;

type PickedFile = { uri: string; name: string; type: string };

export function HelperKycScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const { t } = useI18n();

  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState<PickedFile | null>(null);
  const [idBack, setIdBack] = useState<PickedFile | null>(null);
  const [selfie, setSelfie] = useState<PickedFile | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<HelperProfile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await withAuth((t) => api.helperGetProfile(t));
        if (active) setProfile(p);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [withAuth]);

  const canSubmit = useMemo(() => {
    if (profile?.kycStatus === 'APPROVED') return false;
    return fullName.trim().length >= 3 && idNumber.trim().length >= 4 && !!idFront && !!idBack && !!selfie;
  }, [fullName, idNumber, idFront, idBack, selfie, profile?.kycStatus]);

  const pickDoc = useCallback(async (setter: (f: PickedFile) => void) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const a = res.assets[0];
    setter({
      uri: a.uri,
      name: a.name ?? `file-${Date.now()}`,
      type: a.mimeType ?? 'application/octet-stream',
    });
  }, []);

  const pickSelfie = useCallback(async () => {
    setError(null);
    const pickGallery = async () => {
      try {
        const allowed = await ensureGalleryPermissions();
        if (!allowed) {
          setError(t('helper.kyc.gallery_permission'));
          return;
        }
        const pick = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
          selectionLimit: 1,
          includeExtra: true,
          maxWidth: 1280,
          maxHeight: 1280,
        });
        if (pick.didCancel) return;
        if (pick.errorCode) {
          setError(t('helper.kyc.could_not_open_gallery'));
          return;
        }
        const a = pick.assets?.[0];
        const file = assetToPickedFile(a, `selfie-${Date.now()}.jpg`);
        if (!file) {
          setError(t('helper.kyc.could_not_access_image'));
          return;
        }
        setSelfie(file);
      } catch {
        setError(t('helper.kyc.could_not_open_gallery'));
      }
    };

    try {
      const allowed = await ensureCameraPermissions();
      if (!allowed) {
        setError(t('helper.kyc.camera_permission'));
        return;
      }
      const res = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        cameraType: 'front',
        saveToPhotos: false,
        includeExtra: true,
        maxWidth: 1280,
        maxHeight: 1280,
      });
      if (res.didCancel) {
        // fall back to gallery prompt
      } else if (res.errorCode) {
        setError(t('helper.kyc.camera_unavailable_choose'));
      } else {
        const a = res.assets?.[0];
        const file = assetToPickedFile(a, `selfie-${Date.now()}.jpg`);
        if (!file) {
          setError(t('helper.kyc.could_not_capture'));
          return;
        }
        setSelfie(file);
        return;
      }
    } catch {
      setError(t('helper.kyc.camera_unavailable_choose'));
    }

    Alert.alert(
      t('helper.kyc.camera_unavailable'),
      t('helper.kyc.gallery_choice'),
      [
        { text: t('helper.kyc.choose_gallery'), onPress: () => void pickGallery() },
        { text: t('helper.kyc.cancel'), style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [t]);

  const submit = useCallback(async () => {
    if (busy || !canSubmit || !idFront || !idBack || !selfie) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await withAuth((t) => api.helperSubmitKyc(t, {
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        idFront,
        idBack,
        selfie,
      }));
      setSuccess(t('helper.kyc.success'));
      setTimeout(() => navigation.goBack(), 900);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || t('helper.kyc.could_not_submit'));
      } else {
        setError(t('helper.kyc.could_not_submit'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSubmit, fullName, idBack, idFront, idNumber, navigation, selfie, t, withAuth]);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.topBar}>
          <Text style={styles.h1}>{t('helper.kyc.title')}</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>{t('helper.kyc.back')}</Text>
        </View>

        <Text style={styles.caption}>{t('helper.kyc.upload_notice')}</Text>

        {profile?.kycStatus === 'APPROVED' ? (
          <Notice kind="success" text={t('helper.kyc.approved_notice')} />
        ) : null}

        {error ? <Notice kind="danger" text={error} /> : null}
        {success ? <Notice kind="success" text={success} /> : null}

        <Text style={styles.label}>{t('helper.kyc.full_name')}</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('helper.kyc.name_placeholder')}
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>{t('helper.kyc.id_number')}</Text>
        <TextInput
          value={idNumber}
          onChangeText={setIdNumber}
          placeholder={t('helper.kyc.id_placeholder')}
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          autoCapitalize="characters"
        />

        <View style={styles.uploadRow}>
          <PrimaryButton
            label={idFront ? t('helper.kyc.id_front_selected') : t('helper.kyc.upload_id_front')}
            onPress={() => pickDoc((f) => setIdFront(f))}
            variant="ghost"
            disabled={profile?.kycStatus === 'APPROVED'}
          />
          <PrimaryButton
            label={idBack ? t('helper.kyc.id_back_selected') : t('helper.kyc.upload_id_back')}
            onPress={() => pickDoc((f) => setIdBack(f))}
            variant="ghost"
            disabled={profile?.kycStatus === 'APPROVED'}
          />
          <PrimaryButton
            label={selfie ? t('helper.kyc.selfie_selected') : t('helper.kyc.capture_selfie')}
            onPress={pickSelfie}
            variant="ghost"
            disabled={profile?.kycStatus === 'APPROVED'}
          />
        </View>

        <PrimaryButton label={t('helper.kyc.submit')} onPress={submit} disabled={!canSubmit} loading={busy} />
        <PrimaryButton
          label={t('helper.video_kyc.title')}
          onPress={() => navigation.navigate('HelperVideoKyc')}
          variant="ghost"
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl },
  wrap: { flex: 1, gap: theme.space.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  caption: { color: theme.colors.muted, marginBottom: 8 },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  input: {
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.space.md,
    color: theme.colors.text,
  },
  uploadRow: { gap: theme.space.sm, marginVertical: theme.space.sm },
});
