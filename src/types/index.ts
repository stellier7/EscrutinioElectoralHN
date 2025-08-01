// Database types from Prisma
export type {
  User,
  Election,
  Candidate,
  Mesa,
  Escrutinio,
  Vote,
  Correction,
  AuditLog,
  SystemConfig,
  UserRole,
  ElectionLevel,
  TransmissionStatus,
  AuditLogAction,
} from '@prisma/client';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'VOLUNTEER' | 'ORGANIZATION_MEMBER' | 'ADMIN';
  deviceId: string;
}

export interface AuthResponse {
  user: any; // Using any for now to avoid import issues
  token: string;
  expiresAt: string;
}

// Escrutinio types
export interface EscrutinioRequest {
  electionId: string;
  mesaId: string;
  electionLevel: 'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL';
  latitude: number;
  longitude: number;
  locationAccuracy?: number;
}

export interface VoteInput {
  candidateId: string;
  votes: number;
}

export interface EscrutinioSubmission {
  escrutinioId: string;
  votes: VoteInput[];
  actaImage?: File;
}

// Geolocation types
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

// File upload types
export interface ImageUpload {
  file: File;
  escrutinioId: string;
}

export interface UploadResponse {
  url: string;
  filename: string;
  hash: string;
}

// Dashboard types
export interface ResultSummary {
  electionLevel: 'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL';
  totalMesas: number;
  completedMesas: number;
  totalVotes: number;
  candidates: CandidateResult[];
}

export interface CandidateResult {
  candidate: any; // Using any for now to avoid import issues
  totalVotes: number;
  percentage: number;
}

export interface DashboardData {
  presidentialResults: ResultSummary;
  legislativeResults: ResultSummary;
  municipalResults: ResultSummary;
  transmissionStatus: TransmissionStatusSummary;
  lastUpdate: string;
}

export interface TransmissionStatusSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

// Audit types
export interface AuditLogEntry {
  id: string;
  userId?: string;
  userName?: string;
  action: 'LOGIN' | 'LOGOUT' | 'START_ESCRUTINIO' | 'SUBMIT_RESULTS' | 'UPLOAD_EVIDENCE' | 'CORRECTION' | 'TRANSMISSION' | 'VIEW_RESULTS';
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// Form validation types
export interface ValidationErrors {
  [key: string]: string;
}

// Component props types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

export interface InputProps {
  label?: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'TRANSMISSION_UPDATE' | 'RESULT_UPDATE' | 'SYSTEM_ALERT';
  payload: any;
  timestamp: string;
}

// Security types
export interface EncryptedData {
  data: string;
  iv: string;
  authTag: string;
}

export interface ValidationHash {
  hash: string;
  algorithm: string;
  timestamp: string;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter types
export interface EscrutinioFilters {
  electionId?: string;
  electionLevel?: 'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL';
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  mesaId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Error handling types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Configuration types
export interface AppConfig {
  maxUploadSize: number;
  allowedImageTypes: string[];
  sessionTimeout: number;
  maxLoginAttempts: number;
  geolocationAccuracy: number;
  auditRetentionDays: number;
} 