// Shared constants for the compliance engine frontend

// License type keys for translation
export const LICENSE_TYPE_KEYS = [
  'medical',
  'nursing', 
  'pharmacy',
  'dental',
  'therapy',
  'psychology',
  'socialWork',
  'veterinary',
] as const;

// US State codes for translation
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
] as const;

// Status-related constants
export const LICENSE_STATUSES = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
  PENDING: 'pending',
} as const;

export const DISCIPLINARY_STATUSES = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
} as const;