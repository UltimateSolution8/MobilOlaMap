import type { UserRole } from '../api/types';

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  RoleSelection: undefined;
  Login: { role?: 'BUYER' | 'HELPER' } | undefined;
  EmailLogin: undefined;
  BuyerSignup: undefined;
  HelperSignup: undefined;
  Otp: { phone: string; role: UserRole; devOtp?: string | null };
  Diagnostics: undefined;
};

export type BuyerStackParamList = {
  BuyerHome: undefined;
  BuyerTask: { taskId: string };
  Menu: undefined;
  Profile: undefined;
  History: undefined;
  Payments: undefined;
  Settings: undefined;
  SOS: undefined;
  Terms: undefined;
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
  Diagnostics: undefined;
};

export type HelperStackParamList = {
  HelperHome: undefined;
  HelperKyc: undefined;
  HelperVideoKyc: undefined;
  HelperLiveKycCall: { appId: number; roomId: string; token: string; userId: string; userName: string };
  HelperTask: { taskId: string };
  Menu: undefined;
  Profile: undefined;
  History: undefined;
  Payments: undefined;
  Settings: undefined;
  SOS: undefined;
  Terms: undefined;
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
  Diagnostics: undefined;
};
