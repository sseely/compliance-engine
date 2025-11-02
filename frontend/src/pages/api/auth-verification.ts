/**
 * API endpoint for OAuth provider verification
 * 
 * This endpoint provides tools for manually verifying OAuth providers
 * and storing verification evidence for deployment gates.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { 
  createVerificationResult, 
  saveVerificationResult, 
  getVerificationSummary,
  validateOAuthConfiguration 
} from '@/utils/auth-verification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return handleVerificationSubmission(req, res);
  } else if (req.method === 'GET') {
    return handleVerificationStatus(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle submission of a manual verification result
 */
async function handleVerificationSubmission(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the current session to extract user info
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { provider, success, environment = 'production', errorMessage } = req.body;
    
    if (!provider || typeof success !== 'boolean') {
      return res.status(400).json({ 
        error: 'Missing required fields: provider, success' 
      });
    }
    
    // Create verification result
    const result = createVerificationResult(
      provider,
      success,
      environment,
      session.user.email || undefined,
      errorMessage
    );
    
    // Save the result
    await saveVerificationResult(result);
    
    // Return the result and updated summary
    const summary = await getVerificationSummary(environment);
    
    res.status(200).json({
      result,
      summary,
      message: `Verification recorded for ${provider}`
    });
    
  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle requests for verification status
 */
async function handleVerificationStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { environment = 'production', maxDaysOld = '10' } = req.query;
    
    // Get verification summary
    const summary = await getVerificationSummary(
      environment as string, 
      parseInt(maxDaysOld as string)
    );
    
    // Get configuration validation
    const configValidation = await validateOAuthConfiguration();
    
    res.status(200).json({
      summary,
      configValidation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}