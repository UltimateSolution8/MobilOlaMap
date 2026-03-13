export type UserRole = 'BUYER' | 'HELPER' | 'ADMIN';

export type AuthUser = {
  id: string;
  role: UserRole;
  phone: string;
  displayName?: string | null;
};

export type MeProfile = {
  id: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  displayName?: string | null;
  demoBalancePaise?: number | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type OtpStartResponse = {
  phone: string;
  sent: boolean;
  // API returns `devOtp` in dev to enable deterministic E2E/testing.
  // Keep `otp` as a legacy alias in case older API versions respond with it.
  devOtp?: string | null;
  otp?: string | null;
};

export type TaskUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type CreateTaskRequest = {
  title: string;
  description: string;
  urgency: TaskUrgency;
  timeMinutes: number;
  budgetPaise: number;
  lat: number;
  lng: number;
  addressText?: string | null;
  scheduledAt?: string | null;
};

export type CreateTaskResponse = {
  taskId: string;
  offeredTo: string[];
};

export type PushTokenRequest = {
  token: string;
  platform: string;
};

export type TaskStatus = 'SEARCHING' | 'ASSIGNED' | 'ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

export type Task = {
  id: string;
  buyerId: string;
  buyerPhone?: string | null;
  buyerName?: string | null;
  title: string;
  description: string;
  urgency: TaskUrgency;
  timeMinutes: number;
  budgetPaise: number;
  lat: number;
  lng: number;
  addressText?: string | null;
  status: TaskStatus;
  assignedHelperId?: string | null;
  helperPhone?: string | null;
  helperName?: string | null;
  arrivalOtp?: string | null;
  completionOtp?: string | null;
  arrivalSelfieUrl?: string | null;
  arrivalSelfieLat?: number | null;
  arrivalSelfieLng?: number | null;
  arrivalSelfieAddress?: string | null;
  arrivalSelfieCapturedAt?: string | null;
  completionSelfieUrl?: string | null;
  completionSelfieLat?: number | null;
  completionSelfieLng?: number | null;
  completionSelfieAddress?: string | null;
  completionSelfieCapturedAt?: string | null;
  buyerRating?: number | null;
  buyerRatingComment?: string | null;
  buyerRatedAt?: string | null;
  helperRating?: number | null;
  helperRatingComment?: string | null;
  helperRatedAt?: string | null;
  helperAvgRating?: number | null;
  helperCompletedCount?: number | null;
  buyerAvgRating?: number | null;
  buyerCompletedCount?: number | null;
  cancelReason?: string | null;
  cancelledByRole?: string | null;
  cancelledAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
};

export type TaskOfferedEvent = {
  helperId: string;
  taskId: string;
  title: string;
  description: string;
  urgency: TaskUrgency;
  timeMinutes: number;
  budgetPaise: number;
  lat: number;
  lng: number;
  distanceMeters: number;
  expiresAt?: string | null;
};

export type TaskAssignedEvent = {
  taskId: string;
  buyerId: string;
  helperId: string;
  status: TaskStatus;
};

export type TaskStatusChangedEvent = {
  taskId: string;
  buyerId: string;
  helperId: string;
  status: TaskStatus;
};

export type SupportTicketCategory = 'PAYMENT' | 'SAFETY' | 'QUALITY' | 'CANCELLATION' | 'PRICING' | 'TECH' | 'OTHER';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type SupportTicket = {
  id: string;
  category: SupportTicketCategory;
  subject?: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  relatedTaskId?: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  authorType: 'USER' | 'ADMIN' | 'AI';
  authorUserId?: string | null;
  message: string;
  createdAt: string;
};

export type SupportTicketDetail = SupportTicket & {
  messages: SupportMessage[];
};

export type HelperKycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type HelperProfile = {
  kycStatus: HelperKycStatus;
  kycRejectionReason?: string | null;
  kycFullName?: string | null;
  kycIdNumber?: string | null;
  kycDocFrontUrl?: string | null;
  kycDocBackUrl?: string | null;
  kycSelfieUrl?: string | null;
  kycSubmittedAt?: string | null;
};

export type VideoKycUploadUrl = {
  url: string;
  method: string;
  expiresIn: number;
  key: string;
};

export type VideoKycStartResponse = {
  id: string;
  uploadUrls: {
    video: VideoKycUploadUrl;
    docFront: VideoKycUploadUrl;
    docBack: VideoKycUploadUrl;
  };
  status: string;
};

export type VideoKycStatusResponse = {
  id: string;
  status: string;
  createdAt: string;
  recommendation?: string | null;
  faceMatchScore?: number | null;
  livenessScore?: number | null;
  reviewerNotes?: string | null;
};

export type LiveKycSession = {
  id: string;
  helperId: string;
  helperName?: string | null;
  appId: number;
  roomId: string;
  userId: string;
  userName: string;
  token: string;
  status: string;
  expiresAt: string;
};
