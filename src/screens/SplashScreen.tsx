import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../navigation/types';
import { theme } from '../ui/theme';
import { useI18n } from '../i18n/I18nProvider';
import { APP_DISPLAY_NAME } from '../config';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.in(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    const t = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 3000);
    return () => clearTimeout(t);
  }, [navigation, opacity, pulse, scale, spin]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.haloLayer} pointerEvents="none">
        <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
        <Animated.View style={[styles.ring, { transform: [{ rotate: spinDeg }] }]} />
      </View>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Image source={require('../../assets/superheroo-logo.png')} style={styles.logo} />
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity }]}>{APP_DISPLAY_NAME}</Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity }]}>{t('app.tagline')}</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 180, height: 180, borderRadius: 48 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  tagline: { color: '#E2E8F0', fontWeight: '700' },
  haloLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  ring: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
});
