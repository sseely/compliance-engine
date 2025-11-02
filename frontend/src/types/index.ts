// Shared TypeScript interfaces and types for the compliance engine frontend

export interface FormData {
  licenseNumber: string;
  licenseType: string;
  state: string;
  firstName: string;
  lastName: string;
}

export interface FormErrors {
  licenseNumber?: string;
  licenseType?: string;
  state?: string;
  firstName?: string;
  lastName?: string;
}

export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'revoked' | 'pending';
export type DisciplinaryStatus = 'active' | 'resolved';

export interface DisciplinaryAction {
  date: string;
  type: string;
  description: string;
  status: DisciplinaryStatus;
}

export interface LicenseInfo {
  licenseNumber: string;
  licenseType: string;
  state: string;
  firstName: string;
  lastName: string;
  issueDate?: string;
  expirationDate?: string;
  status: LicenseStatus;
  board?: string;
  specialties?: string[];
  disciplinaryActions?: DisciplinaryAction[];
}

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  licenseInfo?: LicenseInfo;
  lastUpdated: string;
  sources?: string[];
  warnings?: string[];
  errors?: string[];
}

// Component prop interfaces
export interface LicenseVerificationFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
}

export interface LicenseVerificationResultProps {
  result: VerificationResult;
  onReset: () => void;
}