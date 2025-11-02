#!/usr/bin/env node

/**
 * Standalone script to check OAuth verification status
 * Used by CI/CD pipelines and local development
 */

const https = require('https');
const url = require('url');

const STAGING_URL = process.env.STAGING_URL || 'https://staging.compliance-engine.com';
const MAX_DAYS_OLD = parseInt(process.env.MAX_DAYS_OLD || '10');
const API_KEY = process.env.VERIFICATION_API_KEY;

async function checkVerificationStatus(baseUrl, maxDaysOld = 10) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(baseUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `/api/auth-verification?environment=staging&maxDaysOld=${maxDaysOld}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` })
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function formatDaysAgo(days) {
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function getStatusIcon(status) {
  switch (status) {
    case 'success': return '✅';
    case 'failure': return '❌';
    case 'not_tested': return '⭕';
    default: return '❓';
  }
}

async function main() {
  try {
    console.log('🔍 Checking OAuth Provider Verification Status');
    console.log(`📍 Environment: ${STAGING_URL}`);
    console.log(`⏰ Maximum age: ${MAX_DAYS_OLD} days`);
    console.log('─'.repeat(60));

    const result = await checkVerificationStatus(STAGING_URL, MAX_DAYS_OLD);
    const { summary, configValidation } = result;

    // Display summary
    console.log('📊 VERIFICATION SUMMARY');
    console.log(`Last verification: ${summary.last_verification || 'Never'}`);
    console.log(`Days since verification: ${summary.days_since_verification === Infinity ? 'Never' : summary.days_since_verification}`);
    console.log(`All providers verified: ${summary.all_providers_verified ? 'Yes' : 'No'}`);
    console.log(`Deployment allowed: ${summary.deployment_allowed ? 'Yes' : 'No'}`);
    
    console.log('\n🔐 PROVIDER STATUS');
    summary.providers.forEach(provider => {
      const icon = getStatusIcon(provider.status);
      const lastTest = provider.timestamp ? 
        new Date(provider.timestamp).toLocaleDateString() : 'Never';
      const daysSince = provider.timestamp ?
        Math.floor((Date.now() - new Date(provider.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : null;
      const ageText = daysSince !== null ? ` (${formatDaysAgo(daysSince)})` : '';
      
      console.log(`${icon} ${provider.provider.padEnd(12)} ${provider.status.padEnd(10)} ${lastTest}${ageText}`);
      
      if (provider.error_message) {
        console.log(`   ↳ Error: ${provider.error_message}`);
      }
    });

    // Display configuration issues
    if (configValidation && !configValidation.valid) {
      console.log('\n⚠️  CONFIGURATION ISSUES');
      configValidation.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }

    // Final result
    console.log('\n' + '='.repeat(60));
    if (summary.deployment_allowed) {
      console.log('✅ DEPLOYMENT APPROVED');
      console.log('   All OAuth providers have been verified within the required timeframe.');
      process.exit(0);
    } else {
      console.log('❌ DEPLOYMENT BLOCKED');
      console.log('   OAuth providers require verification before deployment.');
      console.log(`   Please visit: ${STAGING_URL}/admin/auth-verification`);
      
      // Provide specific guidance
      const unverifiedProviders = summary.providers
        .filter(p => p.status !== 'success')
        .map(p => p.provider);
      
      if (unverifiedProviders.length > 0) {
        console.log(`   Unverified providers: ${unverifiedProviders.join(', ')}`);
      }
      
      if (summary.days_since_verification > MAX_DAYS_OLD) {
        console.log(`   Last verification was ${summary.days_since_verification} days ago (max: ${MAX_DAYS_OLD})`);
      }
      
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ VERIFICATION CHECK FAILED');
    console.error(`   Error: ${error.message}`);
    console.error(`   URL: ${STAGING_URL}`);
    
    // Check if this is an emergency bypass scenario
    const isEmergencyBypass = process.argv.includes('--emergency-bypass') || 
                              process.env.EMERGENCY_BYPASS === 'true';
    
    if (isEmergencyBypass) {
      console.log('\n🚨 EMERGENCY BYPASS ACTIVATED');
      console.log('   Proceeding with deployment despite verification failure.');
      console.log('   ⚠️  Manual verification strongly recommended after deployment.');
      process.exit(0);
    }
    
    console.log('\n💡 TROUBLESHOOTING');
    console.log('   • Ensure staging environment is accessible');
    console.log('   • Check VERIFICATION_API_KEY if using authentication');
    console.log('   • Verify the auth verification endpoint is deployed');
    console.log('   • Use --emergency-bypass flag for emergency deployments');
    
    process.exit(1);
  }
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
OAuth Provider Verification Checker

Usage: node check-auth-verification.js [options]

Options:
  --help, -h           Show this help message
  --emergency-bypass   Bypass verification check (emergency use only)

Environment Variables:
  STAGING_URL              Base URL for staging environment
  MAX_DAYS_OLD            Maximum days since verification (default: 10)
  VERIFICATION_API_KEY    API key for authenticated requests
  EMERGENCY_BYPASS        Set to 'true' for emergency bypass

Examples:
  node check-auth-verification.js
  STAGING_URL=https://my-staging.com node check-auth-verification.js
  node check-auth-verification.js --emergency-bypass
`);
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});