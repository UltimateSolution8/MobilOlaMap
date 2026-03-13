import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { useUploadQueueProcessor } from '../hooks/useUploadQueueProcessor';
import { SocketProvider } from '../realtime/SocketProvider';
import { ActiveTaskProvider } from '../state/ActiveTaskContext';
import { HelperPresenceProvider } from '../state/HelperPresenceContext';
import { LoginScreen } from '../screens/LoginScreen';
import { EmailLoginScreen } from '../screens/EmailLoginScreen';
import { BuyerSignupScreen } from '../screens/BuyerSignupScreen';
import { HelperSignupScreen } from '../screens/HelperSignupScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { BuyerHomeScreen } from '../screens/buyer/BuyerHomeScreen';
import { BuyerTaskScreen } from '../screens/buyer/BuyerTaskScreen';
import { HelperHomeScreen } from '../screens/helper/HelperHomeScreen';
import { HelperKycScreen } from '../screens/helper/HelperKycScreen';
import { HelperVideoKycScreen } from '../screens/helper/HelperVideoKycScreen';
import { HelperLiveKycCallScreen } from '../screens/helper/HelperLiveKycCallScreen';
import { HelperTaskScreen } from '../screens/helper/HelperTaskScreen';
import { SupportTicketsScreen } from '../screens/support/SupportTicketsScreen';
import { SupportNewTicketScreen } from '../screens/support/SupportNewTicketScreen';
import { SupportTicketScreen } from '../screens/support/SupportTicketScreen';
import { MenuScreen } from '../screens/common/MenuScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { HistoryScreen } from '../screens/common/HistoryScreen';
import { PaymentsScreen } from '../screens/common/PaymentsScreen';
import { SettingsScreen } from '../screens/common/SettingsScreen';
import { DiagnosticsScreen } from '../screens/common/DiagnosticsScreen';
import { PinLockScreen } from '../screens/common/PinLockScreen';
import { SosScreen } from '../screens/common/SosScreen';
import { TermsScreen } from '../screens/common/TermsScreen';
import type { AuthStackParamList, BuyerStackParamList, HelperStackParamList } from './types';
import { theme } from '../ui/theme';
import { useI18n } from '../i18n/I18nProvider';
import { LOCKED_ROLE } from '../config';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BuyerStack = createNativeStackNavigator<BuyerStackParamList>();
const HelperStack = createNativeStackNavigator<HelperStackParamList>();

export function AppNavigator() {
  const { status, user, pinRequired, pinVerified, authNotice } = useAuth();
  const { t } = useI18n();
  useUploadQueueProcessor();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ActiveTaskProvider>
      <NavigationContainer>
        {status !== 'signedIn' || !user ? (
          <AuthStack.Navigator
            screenOptions={{ headerShown: false, animation: 'fade' }}
            initialRouteName={authNotice ? 'Login' : 'Splash'}
          >
            <AuthStack.Screen name="Splash" component={SplashScreen} />
            <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
            {!LOCKED_ROLE ? <AuthStack.Screen name="RoleSelection" component={RoleSelectionScreen} /> : null}
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="EmailLogin" component={EmailLoginScreen} />
            {LOCKED_ROLE !== 'HELPER' ? <AuthStack.Screen name="BuyerSignup" component={BuyerSignupScreen} /> : null}
            {LOCKED_ROLE !== 'BUYER' ? <AuthStack.Screen name="HelperSignup" component={HelperSignupScreen} /> : null}
            <AuthStack.Screen name="Otp" component={OtpScreen} />
            <AuthStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
          </AuthStack.Navigator>
        ) : pinRequired && !pinVerified ? (
          <PinLockScreen />
        ) : (
          <SocketProvider>
            <HelperPresenceProvider>
              {user.role === 'BUYER' ? (
                <BuyerStack.Navigator screenOptions={{ headerShown: false }}>
                  <BuyerStack.Screen name="BuyerHome" component={BuyerHomeScreen} />
                  <BuyerStack.Screen name="BuyerTask" component={BuyerTaskScreen} />
                  <BuyerStack.Screen name="Menu" component={MenuScreen} />
                  <BuyerStack.Screen name="Profile" component={ProfileScreen} />
                  <BuyerStack.Screen name="History" component={HistoryScreen} />
                  <BuyerStack.Screen name="Payments" component={PaymentsScreen} />
                  <BuyerStack.Screen name="Settings" component={SettingsScreen} />
                  <BuyerStack.Screen name="SOS" component={SosScreen} />
                  <BuyerStack.Screen name="Terms" component={TermsScreen} />
                  <BuyerStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                  <BuyerStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
                  <BuyerStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
                  <BuyerStack.Screen name="SupportTicket" component={SupportTicketScreen} />
                </BuyerStack.Navigator>
              ) : user.role === 'HELPER' ? (
                <HelperStack.Navigator screenOptions={{ headerShown: false }}>
                  <HelperStack.Screen name="HelperHome" component={HelperHomeScreen} />
                  <HelperStack.Screen name="HelperKyc" component={HelperKycScreen} />
                  <HelperStack.Screen name="HelperVideoKyc" component={HelperVideoKycScreen} />
                  <HelperStack.Screen name="HelperLiveKycCall" component={HelperLiveKycCallScreen} />
                  <HelperStack.Screen name="HelperTask" component={HelperTaskScreen} />
                  <HelperStack.Screen name="Menu" component={MenuScreen} />
                  <HelperStack.Screen name="Profile" component={ProfileScreen} />
                  <HelperStack.Screen name="History" component={HistoryScreen} />
                  <HelperStack.Screen name="Payments" component={PaymentsScreen} />
                  <HelperStack.Screen name="Settings" component={SettingsScreen} />
                  <HelperStack.Screen name="SOS" component={SosScreen} />
                  <HelperStack.Screen name="Terms" component={TermsScreen} />
                  <HelperStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                  <HelperStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
                  <HelperStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
                  <HelperStack.Screen name="SupportTicket" component={SupportTicketScreen} />
                </HelperStack.Navigator>
              ) : (
                <View style={styles.loading}>
                  <Text style={styles.loadingText}>{t('app.admin_not_supported')}</Text>
                </View>
              )}
            </HelperPresenceProvider>
          </SocketProvider>
        )}
      </NavigationContainer>
    </ActiveTaskProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: theme.colors.muted, fontWeight: '700' },
});
