/**
 * String Constants for Internationalization
 * 
 * This file contains centralized string keys for translation lookups.
 * By using constants instead of magic strings, we can:
 * 1. See how many times each translation is used across the codebase
 * 2. Avoid typos in translation keys
 * 3. Enable IDE autocomplete and type checking
 * 4. Easily refactor translation keys when needed
 * 5. Identify opportunities to consolidate similar translations
 */

// Common UI strings used throughout the application
export const COMMON_STRINGS = {
  // Actions
  LOADING: 'common.loading',
  ERROR: 'common.error', 
  SUCCESS: 'common.success',
  SUBMIT: 'common.submit',
  CANCEL: 'common.cancel',
  SAVE: 'common.save',
  EDIT: 'common.edit',
  DELETE: 'common.delete',
  CONFIRM: 'common.confirm',
  CLOSE: 'common.close',
  NEXT: 'common.next',
  PREVIOUS: 'common.previous',
  REQUIRED: 'common.required',
  OPTIONAL: 'common.optional',
  REFRESH: 'admin.authVerification.refresh',
  
  // Navigation
  HOME: 'navigation.home',
  DASHBOARD: 'navigation.dashboard',
  VERIFICATION: 'navigation.verification',
  SETTINGS: 'navigation.settings',
  PROFILE: 'navigation.profile',
  LOGOUT: 'navigation.logout',
  LANGUAGE: 'navigation.language',
} as const;

// Status values that appear in multiple contexts
export const STATUS_STRINGS = {
  ACTIVE: 'verification.status.active',
  EXPIRED: 'verification.status.expired',
  SUSPENDED: 'verification.status.suspended',
  REVOKED: 'verification.status.revoked',
  PENDING: 'verification.status.pending',
  RESOLVED: 'verification.status.resolved',
  
  // OAuth/Auth status
  SUCCESS: 'admin.authVerification.status.success',
  FAILURE: 'admin.authVerification.status.failure',
  NOT_TESTED: 'admin.authVerification.status.notTested',
  TEST_FAILED: 'admin.authVerification.status.testFailed',
} as const;

// Provider-related strings (used in OAuth contexts)
export const PROVIDER_STRINGS = {
  GOOGLE: 'admin.authVerification.providers.google',
  MICROSOFT: 'admin.authVerification.providers.microsoft',
  LINKEDIN: 'admin.authVerification.providers.linkedin',
  APPLE: 'admin.authVerification.providers.apple',
  
  MANUAL_TEST_REQUIRED: 'admin.authVerification.providers.manualTestRequired',
  AUTOMATED_TEST_AVAILABLE: 'admin.authVerification.providers.automatedTestAvailable',
  OAUTH_NOT_CONFIGURED: 'admin.authVerification.providers.oauthNotConfigured',
  TESTING: 'admin.authVerification.providers.testing',
  LAST_TESTED: 'admin.authVerification.providers.lastTested',
  NEVER_TESTED: 'admin.authVerification.providers.neverTested',
} as const;

// Form-related strings (reusable across forms)
export const FORM_STRINGS = {
  // License verification form
  LICENSE_NUMBER: 'verification.form.licenseNumber',
  LICENSE_NUMBER_PLACEHOLDER: 'verification.form.licenseNumberPlaceholder',
  LICENSE_TYPE: 'verification.form.licenseType',
  SELECT_LICENSE_TYPE: 'verification.form.selectLicenseType',
  STATE: 'verification.form.state',
  SELECT_STATE: 'verification.form.selectState',
  FIRST_NAME: 'verification.form.firstName',
  FIRST_NAME_PLACEHOLDER: 'verification.form.firstNamePlaceholder',
  LAST_NAME: 'verification.form.lastName',
  LAST_NAME_PLACEHOLDER: 'verification.form.lastNamePlaceholder',
  VERIFY_BUTTON: 'verification.form.verifyButton',
  VERIFYING_BUTTON: 'verification.form.verifyingButton',
  HELP_TEXT: 'verification.form.helpText',
  NEW_SEARCH_BUTTON: 'verification.form.newSearchButton',
} as const;

// Validation messages (reusable patterns)
export const VALIDATION_STRINGS = {
  LICENSE_NUMBER_REQUIRED: 'verification.validation.licenseNumberRequired',
  LICENSE_NUMBER_MIN_LENGTH: 'verification.validation.licenseNumberMinLength',
  LICENSE_TYPE_REQUIRED: 'verification.validation.licenseTypeRequired',
  STATE_REQUIRED: 'verification.validation.stateRequired',
  FIRST_NAME_REQUIRED: 'verification.validation.firstNameRequired',
  FIRST_NAME_MIN_LENGTH: 'verification.validation.firstNameMinLength',
  LAST_NAME_REQUIRED: 'verification.validation.lastNameRequired',
  LAST_NAME_MIN_LENGTH: 'verification.validation.lastNameMinLength',
} as const;

// Error messages (shared across components)
export const ERROR_STRINGS = {
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  LICENSE_NOT_FOUND: 'errors.licenseNotFound',
  NAME_MISMATCH: 'errors.nameMismatch',
  MULTIPLE_SIMILAR: 'errors.multipleSimilar',
  NETWORK_ERROR: 'errors.networkError',
  UNEXPECTED_ERROR: 'errors.unexpectedError',
} as const;

// Admin section strings
export const ADMIN_STRINGS = {
  AUTH_VERIFICATION_TITLE: 'admin.authVerification.title',
  AUTH_VERIFICATION_SUBTITLE: 'admin.authVerification.subtitle',
  DEPLOYMENT_STATUS: 'admin.authVerification.deploymentStatus',
  DEPLOYMENT_ALLOWED: 'admin.authVerification.deploymentAllowed',
  DEPLOYMENT_BLOCKED: 'admin.authVerification.deploymentBlocked',
  LAST_VERIFIED: 'admin.authVerification.lastVerified',
  NEVER: 'admin.authVerification.never',
  CREATE_DEPLOYMENT_GATE: 'admin.authVerification.createDeploymentGate',
  REQUIRED_ACTIONS: 'admin.authVerification.requiredActions',
  CONFIGURATION_ISSUES: 'admin.authVerification.configurationIssues',
  TEST_INSTRUCTIONS: 'admin.authVerification.testInstructions',
  ENVIRONMENT_INFO: 'admin.authVerification.environmentInfo',
  CURRENT_ENVIRONMENT: 'admin.authVerification.currentEnvironment',
  TESTED_BY: 'admin.authVerification.testedBy',
  BACKEND_API: 'admin.authVerification.backendApi',
} as const;

// License types (used in dropdowns)
export const LICENSE_TYPE_STRINGS = {
  SELECT_TYPE: 'verification.licenseTypes.selectType',
  MEDICAL: 'verification.licenseTypes.medical',
  NURSING: 'verification.licenseTypes.nursing',
  PHARMACY: 'verification.licenseTypes.pharmacy',
  DENTAL: 'verification.licenseTypes.dental',
  THERAPY: 'verification.licenseTypes.therapy',
  PSYCHOLOGY: 'verification.licenseTypes.psychology',
  SOCIAL_WORK: 'verification.licenseTypes.socialWork',
  VETERINARY: 'verification.licenseTypes.veterinary',
} as const;

// State selection (used in dropdowns)
export const STATE_STRINGS = {
  SELECT_STATE: 'states.selectState',
  // US States - using key pattern for dynamic lookup
  // Usage: `states.${stateCode}` where stateCode is like 'CA', 'NY', etc.
} as const;

// Result/Display strings
export const RESULT_STRINGS = {
  VERIFIED: 'verification.result.verified',
  FAILED: 'verification.result.failed',
  CONFIDENCE: 'verification.result.confidence',
  LICENSE_INFORMATION: 'verification.result.licenseInformation',
  LICENSEE: 'verification.result.licensee',
  STATUS: 'verification.result.status',
  LICENSING_BOARD: 'verification.result.licensingBoard',
  ISSUE_DATE: 'verification.result.issueDate',
  EXPIRATION_DATE: 'verification.result.expirationDate',
  SPECIALTIES: 'verification.result.specialties',
  DISCIPLINARY_ACTIONS: 'verification.result.disciplinaryActions',
  WARNINGS: 'verification.result.warnings',
  ERRORS: 'verification.result.errors',
  LAST_UPDATED: 'verification.result.lastUpdated',
  DATA_SOURCES: 'verification.result.dataSources',
  DATA_SOURCES_COUNT: 'verification.result.dataSourcesCount',
} as const;

// Instruction steps (reusable patterns)
export const INSTRUCTION_STRINGS = {
  STEP_1: 'admin.authVerification.instructions.step1',
  STEP_2: 'admin.authVerification.instructions.step2',
  STEP_3: 'admin.authVerification.instructions.step3',
  STEP_4: 'admin.authVerification.instructions.step4',
  STEP_5: 'admin.authVerification.instructions.step5',
} as const;

// Time/Date related strings
export const TIME_STRINGS = {
  LAST_UPDATED: 'verification.result.lastUpdated',
  LAST_VERIFIED: 'admin.authVerification.lastVerified',
  LAST_TESTED: 'admin.authVerification.providers.lastTested',
  NEVER: 'admin.authVerification.never',
  NEVER_TESTED: 'admin.authVerification.providers.neverTested',
} as const;

// Consolidated export for easy importing
export const STRING_CONSTANTS = {
  COMMON: COMMON_STRINGS,
  STATUS: STATUS_STRINGS,
  PROVIDER: PROVIDER_STRINGS,
  FORM: FORM_STRINGS,
  VALIDATION: VALIDATION_STRINGS,
  ERROR: ERROR_STRINGS,
  ADMIN: ADMIN_STRINGS,
  LICENSE_TYPE: LICENSE_TYPE_STRINGS,
  STATE: STATE_STRINGS,
  RESULT: RESULT_STRINGS,
  INSTRUCTION: INSTRUCTION_STRINGS,
  TIME: TIME_STRINGS,
} as const;

// Type exports for better TypeScript support
export type CommonStringKey = typeof COMMON_STRINGS[keyof typeof COMMON_STRINGS];
export type StatusStringKey = typeof STATUS_STRINGS[keyof typeof STATUS_STRINGS];
export type ProviderStringKey = typeof PROVIDER_STRINGS[keyof typeof PROVIDER_STRINGS];
export type FormStringKey = typeof FORM_STRINGS[keyof typeof FORM_STRINGS];
export type ValidationStringKey = typeof VALIDATION_STRINGS[keyof typeof VALIDATION_STRINGS];
export type ErrorStringKey = typeof ERROR_STRINGS[keyof typeof ERROR_STRINGS];
export type AdminStringKey = typeof ADMIN_STRINGS[keyof typeof ADMIN_STRINGS];
export type LicenseTypeStringKey = typeof LICENSE_TYPE_STRINGS[keyof typeof LICENSE_TYPE_STRINGS];
export type StateStringKey = typeof STATE_STRINGS[keyof typeof STATE_STRINGS];
export type ResultStringKey = typeof RESULT_STRINGS[keyof typeof RESULT_STRINGS];
export type InstructionStringKey = typeof INSTRUCTION_STRINGS[keyof typeof INSTRUCTION_STRINGS];
export type TimeStringKey = typeof TIME_STRINGS[keyof typeof TIME_STRINGS];

// Union type of all string keys
export type StringConstantKey = 
  | CommonStringKey
  | StatusStringKey
  | ProviderStringKey
  | FormStringKey
  | ValidationStringKey
  | ErrorStringKey
  | AdminStringKey
  | LicenseTypeStringKey
  | StateStringKey
  | ResultStringKey
  | InstructionStringKey
  | TimeStringKey;