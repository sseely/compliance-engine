/**
 * OAuth utility functions for provider authentication testing
 * Handles real OAuth flows for Google, Microsoft, LinkedIn, and Apple
 */

import {
  OAUTH_PROVIDERS,
  OAUTH_AUTH_URLS,
  OAUTH_SCOPES,
  OAUTH_CALLBACK_PATHS,
  OAUTH_ENV_VARS,
  OAUTH_RESPONSE_TYPES,
  OAUTH_RESPONSE_MODES,
  OAUTH_TEST_CONFIG,
  OAUTH_ERROR_MESSAGES,
  OAUTH_MESSAGE_TYPES,
  type OAuthProviderId,
} from '@/constants/oauth';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
}

export interface OAuthResult {
  success: boolean;
  userEmail?: string;
  error?: string;
  provider: string;
}

// OAuth provider configurations
export const OAUTH_CONFIGS: Record<OAuthProviderId, OAuthConfig> = {
  [OAUTH_PROVIDERS.GOOGLE]: {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}${OAUTH_CALLBACK_PATHS[OAUTH_PROVIDERS.GOOGLE]}`,
    scope: OAUTH_SCOPES[OAUTH_PROVIDERS.GOOGLE],
    authUrl: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.GOOGLE]
  },
  [OAUTH_PROVIDERS.MICROSOFT]: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}${OAUTH_CALLBACK_PATHS[OAUTH_PROVIDERS.MICROSOFT]}`,
    scope: OAUTH_SCOPES[OAUTH_PROVIDERS.MICROSOFT],
    authUrl: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.MICROSOFT]
  },
  [OAUTH_PROVIDERS.LINKEDIN]: {
    clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '',
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}${OAUTH_CALLBACK_PATHS[OAUTH_PROVIDERS.LINKEDIN]}`,
    scope: OAUTH_SCOPES[OAUTH_PROVIDERS.LINKEDIN],
    authUrl: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.LINKEDIN]
  },
  [OAUTH_PROVIDERS.APPLE]: {
    clientId: process.env.NEXT_PUBLIC_APPLE_ID || '',
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}${OAUTH_CALLBACK_PATHS[OAUTH_PROVIDERS.APPLE]}`,
    scope: OAUTH_SCOPES[OAUTH_PROVIDERS.APPLE],
    authUrl: OAUTH_AUTH_URLS[OAUTH_PROVIDERS.APPLE]
  }
};

/**
 * Initiates OAuth flow by opening popup window
 */
export function initiateOAuthFlow(providerId: string): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const config = OAUTH_CONFIGS[providerId as OAuthProviderId];
    if (!config || !config.clientId) {
      reject(new Error(`${OAUTH_ERROR_MESSAGES.CONFIG_MISSING} for ${providerId}`));
      return;
    }

    // Build OAuth URL with parameters
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: OAUTH_RESPONSE_TYPES.CODE,
      scope: config.scope,
      state: generateStateParameter(providerId),
      ...(providerId === OAUTH_PROVIDERS.MICROSOFT && { response_mode: OAUTH_RESPONSE_MODES.QUERY }),
      ...(providerId === OAUTH_PROVIDERS.APPLE && { response_mode: OAUTH_RESPONSE_MODES.FORM_POST })
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;

    // Open OAuth popup
    const popup = window.open(
      authUrl,
      `oauth-${providerId}`,
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      reject(new Error(OAUTH_ERROR_MESSAGES.POPUP_BLOCKED));
      return;
    }

    // Listen for messages from popup
    const messageListener = (event: MessageEvent) => {
      // Verify origin for security and filter out non-OAuth messages
      if (event.origin !== window.location.origin) {
        return;
      }

      // Filter out React DevTools and other non-OAuth messages
      if (!event.data || typeof event.data.type !== 'string' || 
          (!event.data.type.startsWith('OAUTH_') && event.data.source !== 'oauth-callback')) {
        return;
      }

      console.log('OAuth message received:', event.data);

      if (event.data.type === OAUTH_MESSAGE_TYPES.SUCCESS || event.data.type === 'OAUTH_SUCCESS') {
        console.log('OAuth success message received, closing popup');
        window.removeEventListener('message', messageListener);
        try {
          popup.close();
        } catch (e) {
          console.log('Could not close popup:', e);
        }
        resolve({
          success: true,
          userEmail: event.data.userEmail,
          provider: providerId
        });
      } else if (event.data.type === OAUTH_MESSAGE_TYPES.ERROR || event.data.type === 'OAUTH_ERROR') {
        console.log('OAuth error message received, closing popup');
        window.removeEventListener('message', messageListener);
        try {
          popup.close();
        } catch (e) {
          console.log('Could not close popup:', e);
        }
        resolve({
          success: false,
          error: event.data.error,
          provider: providerId
        });
      }
    };

    window.addEventListener('message', messageListener);

    // Handle popup closed manually - use try/catch for Cross-Origin-Opener-Policy
    const checkClosed = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          resolve({
            success: false,
            error: OAUTH_ERROR_MESSAGES.CANCELLED,
            provider: providerId
          });
        }
      } catch (e) {
        // Cross-Origin-Opener-Policy blocks access to popup.closed
        // Continue checking - the message listener will handle success/error
      }
    }, 1000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', messageListener);
      if (!popup.closed) {
        popup.close();
      }
      resolve({
        success: false,
        error: OAUTH_ERROR_MESSAGES.TIMEOUT,
        provider: providerId
      });
    }, OAUTH_TEST_CONFIG.TIMEOUT_MS);
  });
}

/**
 * Generates a secure state parameter for OAuth CSRF protection
 */
function generateStateParameter(providerId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return btoa(`${providerId}:${timestamp}:${random}`);
}

/**
 * Validates OAuth state parameter
 */
export function validateStateParameter(state: string, expectedProvider: string): boolean {
  try {
    const decoded = atob(state);
    const [provider, timestamp] = decoded.split(':');
    
    // Check provider matches
    if (provider !== expectedProvider) {
      return false;
    }
    
    // Check timestamp is within last 10 minutes
    const now = Date.now();
    const stateTime = parseInt(timestamp);
    if (now - stateTime > OAUTH_TEST_CONFIG.STATE_VALIDITY_MS) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if OAuth is properly configured for a provider
 */
export function isOAuthConfigured(providerId: string): boolean {
  const config = OAUTH_CONFIGS[providerId as OAuthProviderId];
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`OAuth config check for ${providerId}:`, {
      config,
      clientId: config?.clientId,
      hasClientId: !!config?.clientId,
      includesTest: config?.clientId?.includes('test')
    });
  }
  
  return !!(config && config.clientId && !config.clientId.includes('test'));
}