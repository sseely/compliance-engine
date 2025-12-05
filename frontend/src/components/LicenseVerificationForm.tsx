'use client';

import { useState, useEffect } from 'react';
import type { FormData, FormErrors, LicenseVerificationFormProps } from '@/types';
import { useLicenseTypeOptions, useStateOptions } from '@/utils/i18n';
import { useTranslations } from 'next-intl';
import { useAriaAnnouncements } from '@/hooks/useAccessibility';
import { VALIDATION_RULES } from '@/constants';

export default function LicenseVerificationForm({ onSubmit, isLoading = false }: LicenseVerificationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    licenseNumber: '',
    licenseType: '',
    state: '',
    firstName: '',
    lastName: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  
  // Get translated options and text
  const licenseTypeOptions = useLicenseTypeOptions();
  const stateOptions = useStateOptions();
  const t = useTranslations('verification.form');
  const validationT = useTranslations('verification.validation');
  
  // Accessibility announcements
  const { announceFormError, announceLoadingState } = useAriaAnnouncements();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = validationT('licenseNumberRequired');
    } else if (formData.licenseNumber.length < VALIDATION_RULES.LICENSE_NUMBER_MIN_LENGTH) {
      newErrors.licenseNumber = validationT('licenseNumberMinLength');
    }

    if (!formData.licenseType) {
      newErrors.licenseType = validationT('licenseTypeRequired');
    }

    if (!formData.state) {
      newErrors.state = validationT('stateRequired');
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = validationT('firstNameRequired');
    } else if (formData.firstName.length < VALIDATION_RULES.FIRST_NAME_MIN_LENGTH) {
      newErrors.firstName = validationT('firstNameMinLength');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = validationT('lastNameRequired');
    } else if (formData.lastName.length < VALIDATION_RULES.LAST_NAME_MIN_LENGTH) {
      newErrors.lastName = validationT('lastNameMinLength');
    }

    setErrors(newErrors);
    
    // Announce validation errors to screen readers
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.entries(newErrors)[0];
      if (firstError) {
        announceFormError(firstError[0], firstError[1]!);
      }
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      announceFormError('submission', 'An error occurred while submitting the form. Please try again.');
    }
  };
  
  // Announce loading state changes
  useEffect(() => {
    announceLoadingState(isLoading, 'license verification');
  }, [isLoading, announceLoadingState]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="license-verification-container">
      <div className="license-verification-card">
        <div className="license-verification-header">
          <h2 className="license-verification-title">{t('title')}</h2>
          <p className="license-verification-subtitle">
            {t('subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="license-verification-form" noValidate aria-label="License verification form">
          <div className="license-verification-grid">
            <div className="license-verification-field">
              <label htmlFor="licenseNumber" className="license-verification-label">
                {t('licenseNumber')} *
              </label>
              <input
                id="licenseNumber"
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                className={`license-verification-input ${errors.licenseNumber ? 'license-verification-input-error' : ''}`}
                placeholder={t('licenseNumberPlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.licenseNumber ? 'licenseNumber-error' : undefined}
              />
              {errors.licenseNumber && (
                <span id="licenseNumber-error" className="license-verification-error" role="alert">
                  {errors.licenseNumber}
                </span>
              )}
            </div>

            <div className="license-verification-field">
              <label htmlFor="licenseType" className="license-verification-label">
                {t('licenseType')} *
              </label>
              <select
                id="licenseType"
                value={formData.licenseType}
                onChange={(e) => handleInputChange('licenseType', e.target.value)}
                className={`license-verification-select ${errors.licenseType ? 'license-verification-input-error' : ''}`}
                disabled={isLoading}
                aria-describedby={errors.licenseType ? 'licenseType-error' : undefined}
              >
                {licenseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.licenseType && (
                <span id="licenseType-error" className="license-verification-error" role="alert">
                  {errors.licenseType}
                </span>
              )}
            </div>

            <div className="license-verification-field">
              <label htmlFor="state" className="license-verification-label">
                {t('state')} *
              </label>
              <select
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className={`license-verification-select ${errors.state ? 'license-verification-input-error' : ''}`}
                disabled={isLoading}
                aria-describedby={errors.state ? 'state-error' : undefined}
              >
                {stateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.state && (
                <span id="state-error" className="license-verification-error" role="alert">
                  {errors.state}
                </span>
              )}
            </div>

            <div className="license-verification-field">
              <label htmlFor="firstName" className="license-verification-label">
                {t('firstName')} *
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`license-verification-input ${errors.firstName ? 'license-verification-input-error' : ''}`}
                placeholder={t('firstNamePlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              />
              {errors.firstName && (
                <span id="firstName-error" className="license-verification-error" role="alert">
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className="license-verification-field">
              <label htmlFor="lastName" className="license-verification-label">
                {t('lastName')} *
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`license-verification-input ${errors.lastName ? 'license-verification-input-error' : ''}`}
                placeholder={t('lastNamePlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              />
              {errors.lastName && (
                <span id="lastName-error" className="license-verification-error" role="alert">
                  {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="license-verification-actions">
            <button
              type="submit"
              className="license-verification-submit-button"
              disabled={isLoading}
              aria-describedby="submit-help"
            >
              {isLoading ? (
                <>
                  <span className="license-verification-spinner" aria-hidden="true"></span>
                  {t('verifyingButton')}
                </>
              ) : (
                t('verifyButton')
              )}
            </button>
            <p id="submit-help" className="license-verification-help-text">
              {t('helpText')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}