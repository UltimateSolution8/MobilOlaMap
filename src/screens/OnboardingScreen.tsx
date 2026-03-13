import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { PrimaryButton } from '../ui/PrimaryButton';
import { theme } from '../ui/theme';
import { Segmented } from '../ui/Segmented';
import { useI18n } from '../i18n/I18nProvider';
import { APP_DISPLAY_NAME } from '../config';
import { LOCKED_ROLE } from '../config';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageWidth = width;
  const cardWidth = Math.min(width - 48, 360);
  const { lang, setLang, t } = useI18n();

  const PAGES = useMemo(
    () => [
      {
        title: t('onboard.page1_title'),
        subtitle: t('onboard.page1_sub'),
        badge: '01',
      },
      {
        title: t('onboard.page2_title'),
        subtitle: t('onboard.page2_sub'),
        badge: '02',
      },
      {
        title: t('onboard.page3_title'),
        subtitle: t('onboard.page3_sub'),
        badge: '03',
      },
    ],
    [t],
  );

  const ctaLabel = useMemo(
    () => (page === PAGES.length - 1 ? t('onboard.get_started') : t('onboard.next')),
    [page, PAGES.length, t],
  );

  const onNext = () => {
    if (page < PAGES.length - 1) {
      const next = page + 1;
      setPage(next);
      scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
    } else {
      if (LOCKED_ROLE) {
        navigation.replace('Login', { role: LOCKED_ROLE });
      } else {
        navigation.replace('RoleSelection');
      }
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <View style={styles.langRow}>
          <Segmented
            value={lang}
            onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
            options={[
              { key: 'en', label: t('language.en') },
              { key: 'hi', label: t('language.hi') },
              { key: 'te', label: t('language.te') },
            ]}
          />
        </View>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
          <View>
            <Text style={styles.brand}>{APP_DISPLAY_NAME}</Text>
            <Text style={styles.tagline}>{t('app.tagline')}</Text>
          </View>
        </View>
        <Text
          style={styles.skip}
          onPress={() => (LOCKED_ROLE ? navigation.replace('Login', { role: LOCKED_ROLE }) : navigation.replace('RoleSelection'))}
        >
          {t('onboard.skip')}
        </Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={scrollRef}
        snapToInterval={pageWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
          setPage(Math.min(Math.max(next, 0), PAGES.length - 1));
        }}
      >
        {PAGES.map((item) => (
          <View key={item.title} style={[styles.page, { width: pageWidth }]}>
            <View style={[styles.card, { width: cardWidth }]}>
              <Image source={require('../../assets/superheroo-logo.png')} style={styles.pageLogo} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PAGES.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === page ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
        <PrimaryButton label={ctaLabel} onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, paddingTop: 12 },
  scrollContent: { alignItems: 'center' },
  header: { paddingHorizontal: 20, gap: 12 },
  langRow: { alignItems: 'flex-start', marginBottom: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 16 },
  brand: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  tagline: { color: theme.colors.muted, fontSize: 12 },
  skip: { color: theme.colors.primary, fontWeight: '700', alignSelf: 'flex-end', marginTop: 4 },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    gap: 10,
    alignSelf: 'center',
    ...theme.shadow.card,
  },
  pageLogo: { width: 86, height: 86, borderRadius: 22, alignSelf: 'center' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { color: theme.colors.muted, lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  dotActive: { width: 22, backgroundColor: theme.colors.primary },
  cta: { paddingHorizontal: 24, paddingVertical: 24 },
});
