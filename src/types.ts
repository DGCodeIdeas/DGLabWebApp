export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  status: 'active' | 'pending' | 'suspended';
  mfaEnabled?: boolean;
  role: 'admin' | 'user';
}

export interface Tenant {
  id: string;
  identifier: string;
  domain?: string;
  status: 'active' | 'inactive';
  config?: Record<string, any>;
}

export interface Job {
  id: string;
  serviceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  userId: string;
  createdAt: any;
  completedAt?: any;
}

export interface AuditLog {
  id: string;
  userId?: string;
  category: string;
  eventType: string;
  identifier?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
  createdAt: any;
}
