/**
 * Apple OAuth callback handler
 * Processes OAuth response and communicates result to parent window
 * Note: Apple uses POST callbacks, so this handles both GET and POST
 */

'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { validateStateParameter } from '@/utils/oauth';

function AppleOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Apple can send data via URL params or POST body
      // For GET callback (fallback)
      let code = searchParams.get('code');
      let error = searchParams.get('error');
      let state = searchParams.get('state');

      // Check if this was a POST callback (Apple's preferred method)
      // In a real implementation, you'd handle POST data differently
      if (!code && !error) {
        // For demo purposes, we'll assume GET callback
        // In production, you'd need server-side handling for POST
      }

      // Validate state parameter for CSRF protection
      if (state && !validateStateParameter(state, 'apple')) {
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
          error: `Apple OAuth error: ${error}`
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
          error: 'No authorization code received from Apple (may require server-side POST handling)'
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
          userEmail: 'apple-user@privaterelay.appleid.com', // Apple uses privacy relay emails
          provider: 'apple',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>Processing Apple authentication...</p>
        <p className="text-sm text-gray-500 mt-2">This window will close automatically.</p>
        <p className="text-xs text-gray-400 mt-4">
          Debug: {searchParams.get('code') ? 'Code received' : 'No code'} | 
          {' '}Opener: {typeof window !== 'undefined' && window.opener ? 'Yes' : 'No'}
        </p>
        <p className="text-xs text-gray-400">
          Note: Apple uses POST callbacks - full implementation requires server-side handling
        </p>
      </div>
    </div>
  );
}

export default function AppleOAuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <AppleOAuthCallbackContent />
    </Suspense>
  );
}

/**
 * Note: Apple Sign In uses form_post response mode, which means the authorization
 * code is sent via POST request to this endpoint. In a production environment,
 * you would need server-side handling to process the POST data.
 * For this demo, we're showing the fallback GET handling.
 */