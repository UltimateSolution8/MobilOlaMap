// Silence noisy RN warnings in test output

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
    }
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
    const { View } = require('react-native');
    const MockMapView = (props) => <View testID="map-view" {...props} />;
    MockMapView.displayName = 'MapView';
    const MockMarker = (props) => <View testID="marker" {...props} />;
    MockMarker.displayName = 'Marker';
    return {
        __esModule: true,
        default: MockMapView,
        Marker: MockMarker,
        Polyline: (props) => <View testID="polyline" {...props} />,
        PROVIDER_GOOGLE: 'google',
    };
});

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
        connected: false,
    })),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 12.9716, longitude: 77.5946 },
    }),
    getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
    hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
    getProviderStatusAsync: jest.fn().mockResolvedValue({
        locationServicesEnabled: true,
        gpsAvailable: true,
        networkAvailable: true,
    }),
    reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
    watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    enableNetworkProviderAsync: jest.fn().mockResolvedValue(undefined),
    Accuracy: { Balanced: 3 },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-token' }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setNotificationHandler: jest.fn(),
}));

// Mock @react-native-voice/voice
jest.mock('@react-native-voice/voice', () => ({
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
    removeAllListeners: jest.fn(),
    onSpeechResults: null,
    onSpeechPartialResults: null,
    onSpeechError: null,
    onSpeechEnd: null,
}));
