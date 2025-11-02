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

// Validation constants
export const VALIDATION_RULES = {
  LICENSE_NUMBER_MIN_LENGTH: 3,
  FIRST_NAME_MIN_LENGTH: 2,
  LAST_NAME_MIN_LENGTH: 2,
  LANGUAGE_CODE_MIN_LENGTH: 2,
} as const;

// Confidence score thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 70,
  MIN: 0,
  MAX: 100,
} as const;

// Timing constants (in milliseconds)
export const TIMING = {
  ACCESSIBILITY_DEBOUNCE: 100,
  SUCCESS_MESSAGE_DURATION: 5000,
  DEMO_VERIFICATION_DELAY: 2000,
  TEST_TIMEOUT: 100,
} as const;

// SVG icon dimensions
export const ICON_SIZES = {
  SMALL: 16,
  MEDIUM: 24,
  LARGE: 32,
} as const;

// Default API configuration
export const API_CONFIG = {
  DEFAULT_BASE_URL: 'http://localhost:8000',
  DEFAULT_PORT: 8000,
} as const;