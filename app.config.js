const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const appJson = require('./app.json');

const expo = appJson.expo || {};
const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '';
const olaMapsClientId = process.env.EXPO_PUBLIC_OLA_MAPS_CLIENT_ID || '';
const olaMapsClientSecret = process.env.EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET || '';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.mysuperhero.xyz';
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://api.mysuperhero.xyz';
const appVariantRaw = (process.env.EXPO_PUBLIC_APP_VARIANT || process.env.APP_VARIANT || 'unified').trim().toLowerCase();
const appVariant = appVariantRaw === 'buyer' || appVariantRaw === 'helper' ? appVariantRaw : 'unified';
const variantMeta =
  appVariant === 'buyer'
    ? {
        name: 'Superherooo Citizen OlaMaps',
        slug: 'superheroo-citizen-olamaps',
        androidPackage: 'com.helpinminutes.olamaps.citizen',
        iosBundleIdentifier: 'com.helpinminutes.olamaps.citizen',
      }
    : appVariant === 'helper'
    ? {
        name: 'Superherooo Partner OlaMaps',
        slug: 'superheroo-partner-olamaps',
        androidPackage: 'com.helpinminutes.olamaps.partner',
        iosBundleIdentifier: 'com.helpinminutes.olamaps.partner',
      }
    : {
        name: expo.name,
        slug: expo.slug,
        androidPackage: expo.android && expo.android.package ? expo.android.package : undefined,
        iosBundleIdentifier: expo.ios && expo.ios.bundleIdentifier ? expo.ios.bundleIdentifier : undefined,
      };
const googleServicesFile = path.join(__dirname, 'google-services.json');
const hasGoogleServices =
  fs.existsSync(googleServicesFile) && fs.statSync(googleServicesFile).size > 0;
const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const plugins = Array.from(
  new Set([
    ...basePlugins,
    'expo-image-picker',
    'expo-location',
    'expo-document-picker',
    'expo-notifications',
  ])
);
const androidPermissions = Array.from(
  new Set([
    ...(expo.android && Array.isArray(expo.android.permissions) ? expo.android.permissions : []),
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION',
    'FOREGROUND_SERVICE',
    'CAMERA',
    'READ_MEDIA_IMAGES',
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'INTERNET',
  ]),
);
const iosInfoPlist = {
  ...(expo.ios && expo.ios.infoPlist ? expo.ios.infoPlist : {}),
  NSCameraUsageDescription: 'Allow Superherooo to access the camera for selfie verification.',
  NSPhotoLibraryUsageDescription: 'Allow Superherooo to access your photos for KYC and task selfies.',
  NSLocationWhenInUseUsageDescription: 'Allow Superherooo to access your location for nearby tasks.',
};

function withNetworkSecurity(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(__dirname, 'assets', 'network_security_config.xml');
      const dest = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
        'network_security_config.xml'
      );
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      return config;
    },
  ]);
}

function withManifestNetworkSecurity(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest?.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
}

module.exports = {
  expo: {
    ...expo,
    name: variantMeta.name || expo.name,
    slug: variantMeta.slug || expo.slug,
    plugins: [
      ...plugins,
      withNetworkSecurity,
      withManifestNetworkSecurity,
    ],
    extra: {
      ...(expo.extra || {}),
      apiBaseUrl,
      socketUrl,
      olaMapsApiKey,
      olaMapsClientId,
      olaMapsClientSecret,
      appVariant,
    },
    android: {
      ...(expo.android || {}),
      package: variantMeta.androidPackage || (expo.android && expo.android.package ? expo.android.package : undefined),
      googleServicesFile: hasGoogleServices ? googleServicesFile : undefined,
      usesCleartextTraffic: true,
      permissions: androidPermissions,
    },
    ios: {
      ...(expo.ios || {}),
      bundleIdentifier:
        variantMeta.iosBundleIdentifier || (expo.ios && expo.ios.bundleIdentifier ? expo.ios.bundleIdentifier : undefined),
      infoPlist: iosInfoPlist,
    },
  },
};
