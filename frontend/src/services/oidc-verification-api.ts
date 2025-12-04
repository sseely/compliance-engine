/**
 * API service for OIDC verification dashboard
 * Connects frontend to FastAPI backend for verification tracking
 */

import {
  OAUTH_PROVIDERS,
  OAUTH_ENV_VARS,
  OAUTH_CALLBACK_PATHS,
  VERIFICATION_ENVIRONMENTS,
  type OAuthProviderId,
  type VerificationEnvironment,
} from '@/constants/oauth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface OIDCVerificationRequest {
  provider: string;
  success: boolean;
  environment?: string;
  redirect_uri: string;
  client_id: string;
  user_email?: string;
  error_message?: string;
  test_type?: string;
  metadata?: Record<string, any>;
}

export interface OIDCVerificationResult {
  id: string;
  provider: string;
  status: string;
  environment: string;
  redirect_uri: string;
  client_id: string;
  user_email?: string;
  error_message?: string;
  test_type: string;
  tested_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface OIDCVerificationSummary {
  last_verification?: string;
  days_since_verification: number;
  all_providers_verified: boolean;
  deployment_allowed: boolean;
  verified_providers: string[];
  failed_providers: string[];
  providers: Array<{
    provider: string;
    status: string;
    timestamp?: string;
    environment: string;
    user_email?: string;
    error_message?: string;
    test_type: string;
  }>;
}

export interface DeploymentReadiness {
  deployment_allowed: boolean;
  reason: string;
  required_actions: string[];
}

export interface ConfigValidation {
  valid: boolean;
  issues: string[];
}

class OIDCVerificationAPI {
  private authToken: string | null = null;

  /**
   * Set the authentication token for API requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken() {
    this.authToken = null;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        detail: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.detail || errorData.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Store a verification result
   */
  async storeVerificationResult(request: OIDCVerificationRequest): Promise<{
    success: boolean;
    result_id: string;
    provider: string;
    status: string;
    summary: OIDCVerificationSummary;
    message: string;
  }> {
    return this.apiRequest('/oidc-verification/verify', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get verification summary
   */
  async getVerificationSummary(
    environment: VerificationEnvironment = VERIFICATION_ENVIRONMENTS.PRODUCTION,
    maxDaysOld: number = 10
  ): Promise<OIDCVerificationSummary> {
    const params = new URLSearchParams({
      environment,
      max_days_old: maxDaysOld.toString(),
    });
    
    return this.apiRequest(`/oidc-verification/summary?${params}`);
  }

  /**
   * Check deployment readiness
   */
  async checkDeploymentReadiness(
    environment: VerificationEnvironment = VERIFICATION_ENVIRONMENTS.PRODUCTION
  ): Promise<DeploymentReadiness> {
    const params = new URLSearchParams({ environment });
    return this.apiRequest(`/oidc-verification/deployment-readiness?${params}`);
  }

  /**
   * Update deployment gate
   */
  async updateDeploymentGate(
    environment: VerificationEnvironment = VERIFICATION_ENVIRONMENTS.PRODUCTION
  ): Promise<{
    success: boolean;
    gate_id: string;
    deployment_allowed: boolean;
    all_providers_verified: boolean;
    evaluation_timestamp: string;
    evaluated_by: string;
  }> {
    const params = new URLSearchParams({ environment });
    return this.apiRequest(`/oidc-verification/update-deployment-gate?${params}`, {
      method: 'POST',
    });
  }

  /**
   * Validate OAuth configuration
   */
  async validateConfiguration(): Promise<ConfigValidation> {
    return this.apiRequest('/oidc-verification/config-validation');
  }

  /**
   * Login to platform admin
   */
  async loginPlatformAdmin(email: string, password: string): Promise<{
    success: boolean;
    session_token: string;
    admin: {
      id: string;
      email: string;
      name: string;
      is_active: boolean;
      permissions: string[];
      last_login_at?: string;
      created_at: string;
      updated_at: string;
    };
    message: string;
  }> {
    return this.apiRequest('/platform-admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * Get current platform admin session
   */
  async getCurrentAdmin(): Promise<{
    success: boolean;
    admin: {
      id: string;
      email: string;
      name: string;
      is_active: boolean;
      permissions: string[];
      last_login_at?: string;
      created_at: string;
      updated_at: string;
    };
  }> {
    return this.apiRequest('/platform-admin/me');
  }

  /**
   * Logout platform admin
   */
  async logoutPlatformAdmin(): Promise<{ success: boolean; message: string }> {
    const result = await this.apiRequest<{ success: boolean; message: string }>('/platform-admin/logout', {
      method: 'POST',
    });
    this.clearAuthToken();
    return result;
  }
}

// Export singleton instance
export const oidcVerificationAPI = new OIDCVerificationAPI();

/**
 * Helper function to get client ID for a provider
 */
export function getClientIdForProvider(provider: OAuthProviderId): string {
  const envVar = OAUTH_ENV_VARS[provider];
  return process.env[envVar] || 'not_configured';
}

/**
 * Helper function to get redirect URI for a provider
 */
export function getRedirectUriForProvider(provider: OAuthProviderId): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}${OAUTH_CALLBACK_PATHS[provider]}`;
}