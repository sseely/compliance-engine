/**
 * Production Authentication Configuration Verification System
 * 
 * This system provides tools to verify that OAuth providers are correctly
 * configured in production, with evidence tracking for deployment gates.
 */

import {
  OAUTH_PROVIDERS,
  OAUTH_STATUS,
  OAUTH_TEST_TYPES,
  VERIFICATION_ENVIRONMENTS,
  OAUTH_ENV_VARS,
  type OAuthProviderId,
  type OAuthStatus,
  type OAuthTestType,
  type VerificationEnvironment,
} from '@/constants/oauth';

export interface AuthVerificationResult {
  provider: OAuthProviderId;
  status: OAuthStatus;
  timestamp: string;
  environment: VerificationEnvironment;
  redirect_uri: string;
  client_id: string;
  user_email?: string;
  error_message?: string;
  test_type: OAuthTestType;
}

export interface AuthVerificationSummary {
  last_verification: string;
  days_since_verification: number;
  all_providers_verified: boolean;
  deployment_allowed: boolean;
  providers: AuthVerificationResult[];
}

/**
 * Generate a verification report for a successful OAuth login
 */
export function createVerificationResult(
  provider: OAuthProviderId,
  success: boolean,
  environment: VerificationEnvironment,
  userEmail?: string,
  errorMessage?: string
): AuthVerificationResult {
  const redirectUri = `${process.env.NEXTAUTH_URL || process.env.AUTH_URL}/api/auth/callback/${provider}`;
  const clientId = getClientIdForProvider(provider);
  
  return {
    provider,
    status: success ? OAUTH_STATUS.SUCCESS : OAUTH_STATUS.FAILURE,
    timestamp: new Date().toISOString(),
    environment,
    redirect_uri: redirectUri,
    client_id: clientId,
    user_email: userEmail,
    error_message: errorMessage,
    test_type: OAUTH_TEST_TYPES.MANUAL
  };
}

/**
 * Get the client ID for a provider (safe to log, not the secret)
 */
function getClientIdForProvider(provider: OAuthProviderId): string {
  // Use server-side env vars (without NEXT_PUBLIC_)
  const envVar = OAUTH_ENV_VARS[provider].replace('NEXT_PUBLIC_', '');
  return process.env[envVar] || 'not_configured';
}

/**
 * Load verification results from storage
 */
export async function loadVerificationResults(): Promise<AuthVerificationResult[]> {
  try {
    // In a real implementation, this would load from a database or file
    // For now, we'll use localStorage in browser or file system in Node.js
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth_verification_results');
      return stored ? JSON.parse(stored) : [];
    }
    
    // Server-side: would load from database/file
    return [];
  } catch (error) {
    console.error('Failed to load verification results:', error);
    return [];
  }
}

/**
 * Save verification results to storage
 */
export async function saveVerificationResult(result: AuthVerificationResult): Promise<void> {
  try {
    const existing = await loadVerificationResults();
    
    // Remove any existing results for this provider/environment
    const filtered = existing.filter(
      r => !(r.provider === result.provider && r.environment === result.environment)
    );
    
    const updated = [...filtered, result];
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_verification_results', JSON.stringify(updated));
    }
    
    // Server-side: would save to database/file
    console.log('Verification result saved:', result);
  } catch (error) {
    console.error('Failed to save verification result:', error);
  }
}

/**
 * Generate a summary of verification status for deployment decisions
 */
export async function getVerificationSummary(
  environment: VerificationEnvironment = VERIFICATION_ENVIRONMENTS.PRODUCTION,
  maxDaysOld: number = 10
): Promise<AuthVerificationSummary> {
  const results = await loadVerificationResults();
  const environmentResults = results.filter(r => r.environment === environment);
  
  // Get the most recent result for each provider
  const latestResults = new Map<string, AuthVerificationResult>();
  environmentResults.forEach(result => {
    const existing = latestResults.get(result.provider);
    if (!existing || new Date(result.timestamp) > new Date(existing.timestamp)) {
      latestResults.set(result.provider, result);
    }
  });
  
  const providers = Array.from(latestResults.values());
  const requiredProviders = Object.values(OAUTH_PROVIDERS);
  
  // Add missing providers as not tested
  requiredProviders.forEach(provider => {
    if (!latestResults.has(provider)) {
      providers.push({
        provider,
        status: OAUTH_STATUS.NOT_TESTED,
        timestamp: '',
        environment,
        redirect_uri: `${process.env.NEXTAUTH_URL || process.env.AUTH_URL}/api/auth/callback/${provider}`,
        client_id: getClientIdForProvider(provider),
        test_type: OAUTH_TEST_TYPES.MANUAL
      });
    }
  });
  
  // Find the most recent verification date
  const timestamps = providers
    .filter(p => p.timestamp)
    .map(p => new Date(p.timestamp))
    .sort((a, b) => b.getTime() - a.getTime());
  
  const lastVerification = timestamps[0];
  const daysSince = lastVerification 
    ? Math.floor((Date.now() - lastVerification.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  
  const allProvidersVerified = providers.every(p => p.status === OAUTH_STATUS.SUCCESS);
  const deploymentAllowed = allProvidersVerified && daysSince <= maxDaysOld;
  
  return {
    last_verification: lastVerification?.toISOString() || '',
    days_since_verification: daysSince,
    all_providers_verified: allProvidersVerified,
    deployment_allowed: deploymentAllowed,
    providers
  };
}

/**
 * Validate OAuth configuration without requiring a full login flow
 */
export async function validateOAuthConfiguration(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Check required environment variables
  const requiredEnvVars = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'AZURE_AD_CLIENT_ID',
    'AZURE_AD_CLIENT_SECRET',
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'APPLE_ID',
    'APPLE_SECRET'
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      issues.push(`Missing environment variable: ${envVar}`);
    }
  });
  
  // Validate NEXTAUTH_URL format
  const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (nextAuthUrl) {
    try {
      const url = new URL(nextAuthUrl);
      if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
        issues.push('NEXTAUTH_URL must use HTTPS in production');
      }
    } catch (error) {
      issues.push('NEXTAUTH_URL is not a valid URL');
    }
  }
  
  // Validate redirect URIs are properly formatted
  const providers = Object.values(OAUTH_PROVIDERS);
  providers.forEach(provider => {
    const redirectUri = `${nextAuthUrl}/api/auth/callback/${provider}`;
    try {
      new URL(redirectUri);
    } catch (error) {
      issues.push(`Invalid redirect URI for ${provider}: ${redirectUri}`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}