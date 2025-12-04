/**
 * Custom hook for using string constants with next-intl
 * 
 * This hook provides a type-safe way to use string constants with the useTranslations hook.
 * It also provides analytics on string usage when in development mode.
 */

import { useTranslations } from 'next-intl';
import { 
  STRING_CONSTANTS,
  type StringConstantKey,
  type CommonStringKey,
  type StatusStringKey,
  type ProviderStringKey,
  type FormStringKey,
  type ValidationStringKey,
  type ErrorStringKey,
  type AdminStringKey,
} from '@/constants/strings';

// Development-only usage tracking
const stringUsageMap = new Map<string, number>();

/**
 * Track string usage in development mode
 */
function trackStringUsage(key: string) {
  if (process.env.NODE_ENV === 'development') {
    const currentCount = stringUsageMap.get(key) || 0;
    stringUsageMap.set(key, currentCount + 1);
    
    // Log high-usage strings for potential consolidation opportunities
    const newCount = currentCount + 1;
    if (newCount === 5 || newCount === 10 || newCount % 25 === 0) {
      console.debug(`[StringConstants] "${key}" used ${newCount} times - consider if it can be consolidated`);
    }
  }
}

/**
 * Get current string usage statistics (development only)
 */
export function getStringUsageStats() {
  if (process.env.NODE_ENV !== 'development') {
    return {};
  }
  
  const stats = Object.fromEntries(stringUsageMap);
  const sortedByUsage = Object.entries(stats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20); // Top 20 most used strings
  
  console.table(sortedByUsage);
  return stats;
}

/**
 * Hook for using common UI strings (buttons, actions, navigation)
 */
export function useCommonStrings() {
  const t = useTranslations();
  
  return {
    // Actions
    loading: () => { trackStringUsage(STRING_CONSTANTS.COMMON.LOADING); return t(STRING_CONSTANTS.COMMON.LOADING); },
    error: () => { trackStringUsage(STRING_CONSTANTS.COMMON.ERROR); return t(STRING_CONSTANTS.COMMON.ERROR); },
    success: () => { trackStringUsage(STRING_CONSTANTS.COMMON.SUCCESS); return t(STRING_CONSTANTS.COMMON.SUCCESS); },
    submit: () => { trackStringUsage(STRING_CONSTANTS.COMMON.SUBMIT); return t(STRING_CONSTANTS.COMMON.SUBMIT); },
    cancel: () => { trackStringUsage(STRING_CONSTANTS.COMMON.CANCEL); return t(STRING_CONSTANTS.COMMON.CANCEL); },
    save: () => { trackStringUsage(STRING_CONSTANTS.COMMON.SAVE); return t(STRING_CONSTANTS.COMMON.SAVE); },
    edit: () => { trackStringUsage(STRING_CONSTANTS.COMMON.EDIT); return t(STRING_CONSTANTS.COMMON.EDIT); },
    delete: () => { trackStringUsage(STRING_CONSTANTS.COMMON.DELETE); return t(STRING_CONSTANTS.COMMON.DELETE); },
    confirm: () => { trackStringUsage(STRING_CONSTANTS.COMMON.CONFIRM); return t(STRING_CONSTANTS.COMMON.CONFIRM); },
    close: () => { trackStringUsage(STRING_CONSTANTS.COMMON.CLOSE); return t(STRING_CONSTANTS.COMMON.CLOSE); },
    next: () => { trackStringUsage(STRING_CONSTANTS.COMMON.NEXT); return t(STRING_CONSTANTS.COMMON.NEXT); },
    previous: () => { trackStringUsage(STRING_CONSTANTS.COMMON.PREVIOUS); return t(STRING_CONSTANTS.COMMON.PREVIOUS); },
    required: () => { trackStringUsage(STRING_CONSTANTS.COMMON.REQUIRED); return t(STRING_CONSTANTS.COMMON.REQUIRED); },
    optional: () => { trackStringUsage(STRING_CONSTANTS.COMMON.OPTIONAL); return t(STRING_CONSTANTS.COMMON.OPTIONAL); },
    refresh: () => { trackStringUsage(STRING_CONSTANTS.COMMON.REFRESH); return t(STRING_CONSTANTS.COMMON.REFRESH); },
    
    // Navigation
    home: () => { trackStringUsage(STRING_CONSTANTS.COMMON.HOME); return t(STRING_CONSTANTS.COMMON.HOME); },
    dashboard: () => { trackStringUsage(STRING_CONSTANTS.COMMON.DASHBOARD); return t(STRING_CONSTANTS.COMMON.DASHBOARD); },
    verification: () => { trackStringUsage(STRING_CONSTANTS.COMMON.VERIFICATION); return t(STRING_CONSTANTS.COMMON.VERIFICATION); },
    settings: () => { trackStringUsage(STRING_CONSTANTS.COMMON.SETTINGS); return t(STRING_CONSTANTS.COMMON.SETTINGS); },
    profile: () => { trackStringUsage(STRING_CONSTANTS.COMMON.PROFILE); return t(STRING_CONSTANTS.COMMON.PROFILE); },
    logout: () => { trackStringUsage(STRING_CONSTANTS.COMMON.LOGOUT); return t(STRING_CONSTANTS.COMMON.LOGOUT); },
    language: () => { trackStringUsage(STRING_CONSTANTS.COMMON.LANGUAGE); return t(STRING_CONSTANTS.COMMON.LANGUAGE); },
  };
}

/**
 * Hook for using status-related strings
 */
export function useStatusStrings() {
  const t = useTranslations();
  
  return {
    // License status
    active: () => { trackStringUsage(STRING_CONSTANTS.STATUS.ACTIVE); return t(STRING_CONSTANTS.STATUS.ACTIVE); },
    expired: () => { trackStringUsage(STRING_CONSTANTS.STATUS.EXPIRED); return t(STRING_CONSTANTS.STATUS.EXPIRED); },
    suspended: () => { trackStringUsage(STRING_CONSTANTS.STATUS.SUSPENDED); return t(STRING_CONSTANTS.STATUS.SUSPENDED); },
    revoked: () => { trackStringUsage(STRING_CONSTANTS.STATUS.REVOKED); return t(STRING_CONSTANTS.STATUS.REVOKED); },
    pending: () => { trackStringUsage(STRING_CONSTANTS.STATUS.PENDING); return t(STRING_CONSTANTS.STATUS.PENDING); },
    resolved: () => { trackStringUsage(STRING_CONSTANTS.STATUS.RESOLVED); return t(STRING_CONSTANTS.STATUS.RESOLVED); },
    
    // OAuth/Auth status
    success: () => { trackStringUsage(STRING_CONSTANTS.STATUS.SUCCESS); return t(STRING_CONSTANTS.STATUS.SUCCESS); },
    failure: () => { trackStringUsage(STRING_CONSTANTS.STATUS.FAILURE); return t(STRING_CONSTANTS.STATUS.FAILURE); },
    notTested: () => { trackStringUsage(STRING_CONSTANTS.STATUS.NOT_TESTED); return t(STRING_CONSTANTS.STATUS.NOT_TESTED); },
    testFailed: () => { trackStringUsage(STRING_CONSTANTS.STATUS.TEST_FAILED); return t(STRING_CONSTANTS.STATUS.TEST_FAILED); },
  };
}

/**
 * Hook for using provider-related strings
 */
export function useProviderStrings() {
  const t = useTranslations();
  
  return {
    google: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.GOOGLE); return t(STRING_CONSTANTS.PROVIDER.GOOGLE); },
    microsoft: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.MICROSOFT); return t(STRING_CONSTANTS.PROVIDER.MICROSOFT); },
    linkedin: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.LINKEDIN); return t(STRING_CONSTANTS.PROVIDER.LINKEDIN); },
    apple: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.APPLE); return t(STRING_CONSTANTS.PROVIDER.APPLE); },
    
    manualTestRequired: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.MANUAL_TEST_REQUIRED); return t(STRING_CONSTANTS.PROVIDER.MANUAL_TEST_REQUIRED); },
    automatedTestAvailable: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.AUTOMATED_TEST_AVAILABLE); return t(STRING_CONSTANTS.PROVIDER.AUTOMATED_TEST_AVAILABLE); },
    oauthNotConfigured: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.OAUTH_NOT_CONFIGURED); return t(STRING_CONSTANTS.PROVIDER.OAUTH_NOT_CONFIGURED); },
    testing: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.TESTING); return t(STRING_CONSTANTS.PROVIDER.TESTING); },
    lastTested: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.LAST_TESTED); return t(STRING_CONSTANTS.PROVIDER.LAST_TESTED); },
    neverTested: () => { trackStringUsage(STRING_CONSTANTS.PROVIDER.NEVER_TESTED); return t(STRING_CONSTANTS.PROVIDER.NEVER_TESTED); },
  };
}

/**
 * Hook for using error messages
 */
export function useErrorStrings() {
  const t = useTranslations();
  
  return {
    serviceUnavailable: () => { trackStringUsage(STRING_CONSTANTS.ERROR.SERVICE_UNAVAILABLE); return t(STRING_CONSTANTS.ERROR.SERVICE_UNAVAILABLE); },
    licenseNotFound: () => { trackStringUsage(STRING_CONSTANTS.ERROR.LICENSE_NOT_FOUND); return t(STRING_CONSTANTS.ERROR.LICENSE_NOT_FOUND); },
    nameMismatch: () => { trackStringUsage(STRING_CONSTANTS.ERROR.NAME_MISMATCH); return t(STRING_CONSTANTS.ERROR.NAME_MISMATCH); },
    multipleSimilar: () => { trackStringUsage(STRING_CONSTANTS.ERROR.MULTIPLE_SIMILAR); return t(STRING_CONSTANTS.ERROR.MULTIPLE_SIMILAR); },
    networkError: () => { trackStringUsage(STRING_CONSTANTS.ERROR.NETWORK_ERROR); return t(STRING_CONSTANTS.ERROR.NETWORK_ERROR); },
    unexpectedError: () => { trackStringUsage(STRING_CONSTANTS.ERROR.UNEXPECTED_ERROR); return t(STRING_CONSTANTS.ERROR.UNEXPECTED_ERROR); },
  };
}

/**
 * Generic hook for using any string constant with automatic usage tracking
 */
export function useStringConstant(key: StringConstantKey): string {
  const t = useTranslations();
  trackStringUsage(key);
  return t(key);
}

/**
 * Hook for using multiple string constants at once
 */
export function useStringConstants(keys: StringConstantKey[]): string[] {
  const t = useTranslations();
  return keys.map(key => {
    trackStringUsage(key);
    return t(key);
  });
}

/**
 * Development utility to find duplicate or similar translation values
 * This helps identify consolidation opportunities
 */
export function findSimilarTranslations() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  // This would require loading the actual translation files
  // and comparing values, which is more complex but valuable for maintenance
  console.log('Use this function in development to find similar translation values that could be consolidated');
}