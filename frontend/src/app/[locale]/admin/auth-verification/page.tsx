'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  PlatformAuthProvider, 
  PlatformAdminAuthGuard, 
  PlatformAdminHeader,
  usePlatformAuth 
} from '@/components/PlatformAdminAuth';
import { 
  oidcVerificationAPI, 
  getClientIdForProvider, 
  getRedirectUriForProvider 
} from '@/services/oidc-verification-api';
import type { 
  OIDCVerificationSummary, 
  DeploymentReadiness,
  ConfigValidation 
} from '@/services/oidc-verification-api';
import { ProviderLogos, type ProviderId } from '@/components/providers';
import { initiateOAuthFlow, isOAuthConfigured } from '@/utils/oauth';
import {
  OAUTH_PROVIDERS,
  OAUTH_PROVIDER_NAMES,
  PROVIDER_COLORS,
  VERIFICATION_ENVIRONMENTS,
  type OAuthProviderId,
} from '@/constants/oauth';
import {
  useCommonStrings,
  useStatusStrings,
  useProviderStrings,
  useStringConstant,
} from '@/hooks/useStringConstants';
import { STRING_CONSTANTS } from '@/constants/strings';

interface ProviderConfig {
  id: ProviderId;
  name: string;
  color: string;
  requiresManualTest: boolean;
}

const PROVIDERS: ProviderConfig[] = Object.values(OAUTH_PROVIDERS).map(providerId => ({
  id: providerId as ProviderId,
  name: OAUTH_PROVIDER_NAMES[providerId],
  color: PROVIDER_COLORS[providerId],
  requiresManualTest: providerId === OAUTH_PROVIDERS.LINKEDIN || providerId === OAUTH_PROVIDERS.APPLE
}));

function AuthVerificationDashboard() {
  const { admin } = usePlatformAuth();
  const t = useTranslations('admin.authVerification');
  const common = useCommonStrings();
  const status = useStatusStrings();
  const provider = useProviderStrings();
  const [verificationSummary, setVerificationSummary] = useState<OIDCVerificationSummary | null>(null);
  const [deploymentReadiness, setDeploymentReadiness] = useState<DeploymentReadiness | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [configValidation, setConfigValidation] = useState<ConfigValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [environment, setEnvironment] = useState<string>(VERIFICATION_ENVIRONMENTS.PRODUCTION);

  useEffect(() => {
    loadVerificationStatus();
  }, [environment]);

  const loadVerificationStatus = async () => {
    try {
      // Load verification summary
      const summary = await oidcVerificationAPI.getVerificationSummary(environment);
      setVerificationSummary(summary);

      // Load deployment readiness
      const readiness = await oidcVerificationAPI.checkDeploymentReadiness(environment);
      setDeploymentReadiness(readiness);

      // Load config validation
      const validation = await oidcVerificationAPI.validateConfiguration();
      setConfigValidation(validation);
    } catch (error) {
      console.error('Failed to load verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderTest = async (providerId: OAuthProviderId) => {
    setTestingProvider(providerId);
    
    try {
      // Check if OAuth is properly configured
      if (!isOAuthConfigured(providerId)) {
        throw new Error(`OAuth not configured for ${providerId}. Please set up OAuth credentials.`);
      }

      // Initiate real OAuth flow
      const result = await initiateOAuthFlow(providerId as string);
      
      await recordVerificationResult(
        providerId, 
        result.success, 
        result.error,
        result.userEmail
      );
    } catch (error) {
      console.error(`${providerId} test failed:`, error);
      await recordVerificationResult(providerId, false, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTestingProvider(null);
    }
  };


  const recordVerificationResult = async (provider: string, success: boolean, errorMessage?: string, userEmail?: string) => {
    try {
      await oidcVerificationAPI.storeVerificationResult({
        provider,
        success,
        environment: environment as any,
        redirect_uri: getRedirectUriForProvider(provider as OAuthProviderId),
        client_id: getClientIdForProvider(provider as OAuthProviderId),
        user_email: userEmail || admin?.email,
        error_message: errorMessage,
        test_type: 'manual',
        metadata: {
          tested_from: 'admin_dashboard',
          browser: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
      
      // Reload verification status after recording result
      await loadVerificationStatus();
    } catch (error) {
      console.error('Failed to record verification result:', error);
    }
  };

  const handleUpdateDeploymentGate = async () => {
    try {
      await oidcVerificationAPI.updateDeploymentGate(environment);
      await loadVerificationStatus(); // Reload to show updated status
    } catch (error) {
      console.error('Failed to update deployment gate:', error);
    }
  };

  const getProviderStatus = (providerId: string): 'success' | 'failure' | 'not_tested' => {
    const providerResult = verificationSummary?.providers.find(p => p.provider === providerId);
    return (providerResult?.status as 'success' | 'failure' | 'not_tested') || 'not_tested';
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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Authentication Provider Verification
              </h1>
              <p className="text-gray-600">
                Test OAuth providers to ensure they're properly configured for production deployment.
                All providers must be verified within the last 10 days to allow automatic deployment.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
              <button
                onClick={loadVerificationStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
{common.refresh()}
              </button>
            </div>
          </div>
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
              <p className="text-sm mb-2">
                {verificationSummary?.deployment_allowed 
                  ? 'All providers verified - deployment allowed'
                  : `Verification required - ${verificationSummary?.days_since_verification || 'unknown'} days since last verification`
                }
              </p>
              {deploymentReadiness && !deploymentReadiness.deployment_allowed && (
                <div className="text-sm text-red-600">
                  <strong>Reason:</strong> {deploymentReadiness.reason}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Last verified</div>
              <div className="font-mono text-sm mb-3">
                {verificationSummary?.last_verification 
                  ? formatTimeAgo(verificationSummary.last_verification)
                  : 'Never'
                }
              </div>
              {verificationSummary?.deployment_allowed && (
                <button
                  onClick={handleUpdateDeploymentGate}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Create Deployment Gate
                </button>
              )}
            </div>
          </div>
          
          {deploymentReadiness && deploymentReadiness.required_actions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-red-200">
              <h4 className="font-semibold text-red-800 mb-2">Required Actions:</h4>
              <ul className="list-disc list-inside text-sm text-red-700">
                {deploymentReadiness.required_actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}
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
            const ProviderLogo = ProviderLogos[provider.id];

            return (
              <div
                key={provider.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 mr-3 flex items-center justify-center">
                      <ProviderLogo size={32} className="flex-shrink-0" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{provider.name}</h3>
                      <p className="text-sm text-gray-500">
                        {isOAuthConfigured(provider.id) 
                          ? (provider.requiresManualTest ? 'Manual test required' : 'Automated test available')
                          : 'OAuth not configured'
                        }
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
                  disabled={isCurrentlyTesting || !isOAuthConfigured(provider.id)}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${provider.color}`}
                >
                  {isCurrentlyTesting ? (
                    <span className="flex items-center justify-center">
                      <div className="license-verification-spinner mr-2"></div>
                      Testing...
                    </span>
                  ) : !isOAuthConfigured(provider.id) ? (
                    'OAuth Not Configured'
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
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Current Environment:</span>
              <span className="ml-2 font-mono capitalize">{environment}</span>
            </div>
            <div>
              <span className="text-gray-600">Tested by:</span>
              <span className="ml-2 font-mono">{admin?.email || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-600">Backend API:</span>
              <span className="ml-2 font-mono text-xs">
                {process.env.NEXT_PUBLIC_API_URL || 'localhost:8000'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthVerificationPage() {
  return (
    <PlatformAuthProvider>
      <PlatformAdminAuthGuard>
        <div className="min-h-screen bg-gray-50">
          <PlatformAdminHeader />
          <AuthVerificationDashboard />
        </div>
      </PlatformAdminAuthGuard>
    </PlatformAuthProvider>
  );
}