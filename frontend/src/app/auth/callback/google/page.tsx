/**
 * Google OAuth callback handler
 * Processes OAuth response and communicates result to parent window
 */

'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { validateStateParameter } from '@/utils/oauth';

function GoogleOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      // Validate state parameter for CSRF protection
      if (state && !validateStateParameter(state, 'google')) {
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: 'Invalid state parameter - possible CSRF attack'
        };
        
        if (window.opener) {
          window.opener.postMessage(errorMessage, window.location.origin);
        } else if (window.parent !== window) {
          window.parent.postMessage(errorMessage, window.location.origin);
        }
        
        setTimeout(() => window.close(), 1000);
        return;
      }

      if (error) {
        // OAuth error occurred
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: `Google OAuth error: ${error}`
        };
        
        if (window.opener) {
          window.opener.postMessage(errorMessage, window.location.origin);
        } else if (window.parent !== window) {
          window.parent.postMessage(errorMessage, window.location.origin);
        }
        
        setTimeout(() => window.close(), 1000);
        return;
      }

      if (!code) {
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: 'No authorization code received from Google'
        };
        
        if (window.opener) {
          window.opener.postMessage(errorMessage, window.location.origin);
        } else if (window.parent !== window) {
          window.parent.postMessage(errorMessage, window.location.origin);
        }
        
        setTimeout(() => window.close(), 1000);
        return;
      }

      try {
        // For demo purposes, we'll consider receiving an authorization code as success
        // In production, this would be handled on the backend with proper client secret
        const message = {
          type: 'OAUTH_SUCCESS',
          userEmail: 'google-user@example.com', // Would be real user email in production
          provider: 'google',
          authCode: code // Include the auth code for backend processing
        };

        // Try multiple ways to communicate with parent window
        if (window.opener) {
          // If opened via window.open()
          window.opener.postMessage(message, window.location.origin);
        } else if (window.parent !== window) {
          // If in iframe or popup
          window.parent.postMessage(message, window.location.origin);
        } else {
          // Fallback - try to access opener through window reference
          try {
            window.top?.postMessage(message, window.location.origin);
          } catch (e) {
            console.log('Could not send message to parent window:', e);
          }
        }

        // Close the window after a short delay
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            // Try to close anyway
            try {
              window.close();
            } catch (e) {
              console.log('Could not close window automatically');
            }
          }
        }, 1000);

      } catch (error) {
        const errorMessage = {
          type: 'OAUTH_ERROR',
          error: error instanceof Error ? error.message : 'Failed to process OAuth callback'
        };

        // Try multiple ways to send error message
        if (window.opener) {
          window.opener.postMessage(errorMessage, window.location.origin);
        } else if (window.parent !== window) {
          window.parent.postMessage(errorMessage, window.location.origin);
        }

        // Close window on error too
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('Could not close window on error');
          }
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Processing Google authentication...</p>
        <p className="text-sm text-gray-500 mt-2">This window will close automatically.</p>
        <p className="text-xs text-gray-400 mt-4">
          Debug: {searchParams.get('code') ? 'Code received' : 'No code'} | 
          {' '}Opener: {typeof window !== 'undefined' && window.opener ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  );
}

export default function GoogleOAuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <GoogleOAuthCallbackContent />
    </Suspense>
  );
}

/**
 * Note: In production, the authorization code should be sent to the backend
 * where it can be exchanged for an access token using the client secret.
 * For this demo, we're just validating that OAuth flow completed successfully.
 */