module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|socket\\.io-client)',
    ],
    setupFilesAfterEnv: ['./jest.setup.js'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/types.ts',
    ],
    testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
