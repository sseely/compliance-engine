/**
 * OAuth Provider Constants
 * Centralized constants for OAuth provider configuration to avoid magic strings
 */

// OAuth Provider IDs
export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
  MICROSOFT: 'microsoft', 
  LINKEDIN: 'linkedin',
  APPLE: 'apple',
} as const;

// OAuth Provider Names (for display)
export const OAUTH_PROVIDER_NAMES = {
  [OAUTH_PROVIDERS.GOOGLE]: 'Google',
  [OAUTH_PROVIDERS.MICROSOFT]: 'Microsoft',
  [OAUTH_PROVIDERS.LINKEDIN]: 'LinkedIn',
  [OAUTH_PROVIDERS.APPLE]: 'Apple',
} as const;

// OAuth Authorization URLs
export const OAUTH_AUTH_URLS = {
  [OAUTH_PROVIDERS.GOOGLE]: 'https://accounts.google.com/o/oauth2/v2/auth',
  [OAUTH_PROVIDERS.MICROSOFT]: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  [OAUTH_PROVIDERS.LINKEDIN]: 'https://www.linkedin.com/oauth/v2/authorization',
  [OAUTH_PROVIDERS.APPLE]: 'https://appleid.apple.com/auth/authorize',
} as const;

// OAuth Scopes
export const OAUTH_SCOPES = {
  [OAUTH_PROVIDERS.GOOGLE]: 'openid email profile',
  [OAUTH_PROVIDERS.MICROSOFT]: 'openid email profile',
  [OAUTH_PROVIDERS.LINKEDIN]: 'r_liteprofile r_emailaddress',
  [OAUTH_PROVIDERS.APPLE]: 'name email',
} as const;

// OAuth Response Modes
export const OAUTH_RESPONSE_MODES = {
  QUERY: 'query',
  FORM_POST: 'form_post',
} as const;

// OAuth Response Types
export const OAUTH_RESPONSE_TYPES = {
  CODE: 'code',
  TOKEN: 'token',
} as const;

// Environment Variable Names
export const OAUTH_ENV_VARS = {
  [OAUTH_PROVIDERS.GOOGLE]: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  [OAUTH_PROVIDERS.MICROSOFT]: 'NEXT_PUBLIC_MICROSOFT_CLIENT_ID',
  [OAUTH_PROVIDERS.LINKEDIN]: 'NEXT_PUBLIC_LINKEDIN_CLIENT_ID',
  [OAUTH_PROVIDERS.APPLE]: 'NEXT_PUBLIC_APPLE_ID',
} as const;

// OAuth Test Configuration
export const OAUTH_TEST_CONFIG = {
  TIMEOUT_MS: 300000, // 5 minutes
  SUCCESS_DELAY_MS: 1000,
  ERROR_DELAY_MS: 2000,
  STATE_VALIDITY_MS: 600000, // 10 minutes
} as const;

// OAuth Error Messages
export const OAUTH_ERROR_MESSAGES = {
  POPUP_BLOCKED: 'Failed to open OAuth popup. Please allow popups for this site.',
  INVALID_STATE: 'Invalid state parameter - possible CSRF attack',
  NO_CODE: 'No authorization code received',
  TIMEOUT: 'OAuth flow timed out',
  CANCELLED: 'OAuth flow cancelled by user',
  CONFIG_MISSING: 'OAuth not configured',
  EXCHANGE_FAILED: 'Failed to exchange code for token',
  GENERIC_FAILURE: 'Failed to process OAuth callback',
} as const;

// OAuth Message Types
export const OAUTH_MESSAGE_TYPES = {
  SUCCESS: 'OAUTH_SUCCESS',
  ERROR: 'OAUTH_ERROR',
} as const;

// OAuth Test Types
export const OAUTH_TEST_TYPES = {
  MANUAL: 'manual',
  AUTOMATED: 'automated',
} as const;

// OAuth Status Values
export const OAUTH_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  NOT_TESTED: 'not_tested',
} as const;

// Verification Result Properties
export const VERIFICATION_ENVIRONMENTS = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
} as const;

// Provider Colors (for UI components)
export const PROVIDER_COLORS = {
  [OAUTH_PROVIDERS.GOOGLE]: 'bg-red-500 hover:bg-red-600',
  [OAUTH_PROVIDERS.MICROSOFT]: 'bg-blue-500 hover:bg-blue-600',
  [OAUTH_PROVIDERS.LINKEDIN]: 'bg-blue-700 hover:bg-blue-800',
  [OAUTH_PROVIDERS.APPLE]: 'bg-gray-800 hover:bg-gray-900',
} as const;

// Test user emails (for demo purposes)
export const TEST_USER_EMAILS = {
  [OAUTH_PROVIDERS.GOOGLE]: 'google-user@example.com',
  [OAUTH_PROVIDERS.MICROSOFT]: 'microsoft-user@example.com', 
  [OAUTH_PROVIDERS.LINKEDIN]: 'linkedin-user@example.com',
  [OAUTH_PROVIDERS.APPLE]: 'apple-user@privaterelay.appleid.com',
} as const;

// URL Paths
export const OAUTH_CALLBACK_PATHS = {
  [OAUTH_PROVIDERS.GOOGLE]: '/auth/callback/google',
  [OAUTH_PROVIDERS.MICROSOFT]: '/auth/callback/microsoft',
  [OAUTH_PROVIDERS.LINKEDIN]: '/auth/callback/linkedin',
  [OAUTH_PROVIDERS.APPLE]: '/auth/callback/apple',
} as const;

// Type exports
export type OAuthProviderId = typeof OAUTH_PROVIDERS[keyof typeof OAUTH_PROVIDERS];
export type OAuthStatus = typeof OAUTH_STATUS[keyof typeof OAUTH_STATUS];
export type OAuthTestType = typeof OAUTH_TEST_TYPES[keyof typeof OAUTH_TEST_TYPES];
export type VerificationEnvironment = typeof VERIFICATION_ENVIRONMENTS[keyof typeof VERIFICATION_ENVIRONMENTS];