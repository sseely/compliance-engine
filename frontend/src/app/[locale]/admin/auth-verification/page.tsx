'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import type { AuthVerificationResult, AuthVerificationSummary } from '@/utils/auth-verification';

interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  requiresManualTest: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔍',
    color: 'bg-red-500 hover:bg-red-600',
    requiresManualTest: false
  },
  {
    id: 'azure-ad',
    name: 'Microsoft',
    icon: '🏢',
    color: 'bg-blue-500 hover:bg-blue-600',
    requiresManualTest: false
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    color: 'bg-blue-700 hover:bg-blue-800',
    requiresManualTest: true
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    color: 'bg-gray-800 hover:bg-gray-900',
    requiresManualTest: true
  }
];

export default function AuthVerificationPage() {
  const { data: session } = useSession();
  const t = useTranslations('admin.authVerification');
  const [verificationSummary, setVerificationSummary] = useState<AuthVerificationSummary | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [configValidation, setConfigValidation] = useState<{ valid: boolean; issues: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const response = await fetch('/api/auth-verification');
      const data = await response.json();
      setVerificationSummary(data.summary);
      setConfigValidation(data.configValidation);
    } catch (error) {
      console.error('Failed to load verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderTest = async (providerId: string) => {
    setTestingProvider(providerId);
    
    try {
      // Attempt to sign in with the provider
      const result = await signIn(providerId, { 
        redirect: false,
        callbackUrl: `/admin/auth-verification?verified=${providerId}`
      });
      
      if (result?.error) {
        // Record failed verification
        await recordVerificationResult(providerId, false, result.error);
      } else if (result?.ok) {
        // Success will be handled by the callback URL
        console.log(`${providerId} authentication initiated successfully`);
      }
    } catch (error) {
      console.error(`${providerId} test failed:`, error);
      await recordVerificationResult(providerId, false, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTestingProvider(null);
    }
  };

  const recordVerificationResult = async (provider: string, success: boolean, errorMessage?: string) => {
    try {
      const response = await fetch('/api/auth-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          success,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
          errorMessage
        })
      });
      
      if (response.ok) {
        await loadVerificationStatus();
      }
    } catch (error) {
      console.error('Failed to record verification result:', error);
    }
  };

  // Handle successful OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verifiedProvider = urlParams.get('verified');
    
    if (verifiedProvider && session?.user) {
      recordVerificationResult(verifiedProvider, true);
      // Clean up URL
      window.history.replaceState({}, '', '/admin/auth-verification');
    }
  }, [session]);

  const getProviderStatus = (providerId: string): 'success' | 'failure' | 'not_tested' => {
    const providerResult = verificationSummary?.providers.find(p => p.provider === providerId);
    return providerResult?.status || 'not_tested';
  };

  const getProviderTimestamp = (providerId: string): string => {
    const providerResult = verificationSummary?.providers.find(p => p.provider === providerId);
    return providerResult?.timestamp || '';
  };

  const getStatusIcon = (status: 'success' | 'failure' | 'not_tested') => {
    switch (status) {
      case 'success':
        return <span className="text-green-500 text-xl">✅</span>;
      case 'failure':
        return <span className="text-red-500 text-xl">❌</span>;
      case 'not_tested':
        return <span className="text-gray-400 text-xl">⭕</span>;
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    if (!timestamp) return 'Never tested';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="license-verification-spinner"></div>
          <span className="ml-3">Loading verification status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Authentication Provider Verification
          </h1>
          <p className="text-gray-600">
            Test OAuth providers to ensure they're properly configured for production deployment.
            All providers must be verified within the last 10 days to allow automatic deployment.
          </p>
        </div>

        {/* Deployment Status Card */}
        <div className={`p-6 rounded-lg mb-8 ${
          verificationSummary?.deployment_allowed 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                {verificationSummary?.deployment_allowed ? '🟢' : '🔴'} Deployment Status
              </h2>
              <p className="text-sm">
                {verificationSummary?.deployment_allowed 
                  ? 'All providers verified - deployment allowed'
                  : `Verification required - ${verificationSummary?.days_since_verification || 'unknown'} days since last verification`
                }
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Last verified</div>
              <div className="font-mono text-sm">
                {verificationSummary?.last_verification 
                  ? formatTimeAgo(verificationSummary.last_verification)
                  : 'Never'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Issues */}
        {configValidation && !configValidation.valid && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-8">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Configuration Issues</h3>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {configValidation.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Provider Test Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDERS.map((provider) => {
            const status = getProviderStatus(provider.id);
            const timestamp = getProviderTimestamp(provider.id);
            const isCurrentlyTesting = testingProvider === provider.id;

            return (
              <div
                key={provider.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{provider.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{provider.name}</h3>
                      <p className="text-sm text-gray-500">
                        {provider.requiresManualTest ? 'Manual test required' : 'Automated test available'}
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(status)}
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-1">Last tested:</div>
                  <div className="font-mono text-sm">
                    {formatTimeAgo(timestamp)}
                  </div>
                </div>

                <button
                  onClick={() => handleProviderTest(provider.id)}
                  disabled={isCurrentlyTesting || !session}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${provider.color}`}
                >
                  {isCurrentlyTesting ? (
                    <span className="flex items-center justify-center">
                      <div className="license-verification-spinner mr-2"></div>
                      Testing...
                    </span>
                  ) : (
                    `Test ${provider.name} Login`
                  )}
                </button>

                {status === 'failure' && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    Last test failed. Check provider configuration.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">🔍 Testing Instructions</h3>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2">
            <li>Click "Test [Provider] Login" for each OAuth provider</li>
            <li>Complete the authentication flow in the popup/redirect</li>
            <li>Return to this page to see the green checkmark for successful tests</li>
            <li>All providers must show green checkmarks for deployment approval</li>
            <li>Tests are valid for 10 days - re-test before each production deployment</li>
          </ol>
        </div>

        {/* Environment Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-2">Environment Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Environment:</span>
              <span className="ml-2 font-mono">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Staging'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Base URL:</span>
              <span className="ml-2 font-mono">{process.env.NEXTAUTH_URL || 'Not configured'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}