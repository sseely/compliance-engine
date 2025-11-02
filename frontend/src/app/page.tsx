'use client';

import LicenseVerificationForm from '@/components/LicenseVerificationForm';
import LicenseVerificationResult from '@/components/LicenseVerificationResult';
import { useState } from 'react';
import type { FormData, VerificationResult } from '@/types';
import { LICENSE_STATUSES } from '@/constants';

// Mock API function for development
async function mockVerifyLicense(data: FormData): Promise<VerificationResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock response based on license number
  const mockSuccess = data.licenseNumber.toLowerCase().includes('valid');
  
  if (mockSuccess) {
    return {
      verified: true,
      confidence: 95,
      licenseInfo: {
        licenseNumber: data.licenseNumber,
        licenseType: data.licenseType,
        state: data.state,
        firstName: data.firstName,
        lastName: data.lastName,
        issueDate: '2020-01-15',
        expirationDate: '2025-01-15',
        status: LICENSE_STATUSES.ACTIVE,
        board: 'State Medical Board',
        specialties: ['Internal Medicine', 'Cardiology'],
      },
      lastUpdated: new Date().toISOString(),
      sources: [
        'State Medical Board Database',
        'National Practitioner Data Bank',
        'Federation of State Medical Boards'
      ]
    };
  } else {
    return {
      verified: false,
      confidence: 25,
      lastUpdated: new Date().toISOString(),
      errors: [
        'License number not found in state database',
        'Name does not match license records'
      ],
      warnings: [
        'Multiple similar license numbers found'
      ]
    };
  }
}

export default function HomePage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const verificationResult = await mockVerifyLicense(formData);
      setResult(verificationResult);
    } catch (error) {
      console.error('Verification failed:', error);
      setResult({
        verified: false,
        confidence: 0,
        lastUpdated: new Date().toISOString(),
        errors: ['Service temporarily unavailable. Please try again later.']
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <main>
      <div className="container">
        <header style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h1>Professional License Verification</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.125rem' }}>
            Verify professional credentials quickly and securely
          </p>
        </header>

        {result ? (
          <LicenseVerificationResult result={result} onReset={handleReset} />
        ) : (
          <LicenseVerificationForm onSubmit={handleFormSubmit} isLoading={isLoading} />
        )}
      </div>
    </main>
  );
}