'use client';

import { useState } from 'react';
import styles from './LicenseVerificationForm.module.scss';
import type { FormData, FormErrors, LicenseVerificationFormProps } from '@/types';
import { useLicenseTypeOptions, useStateOptions } from '@/utils/i18n';
import { useTranslations } from 'next-intl';

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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = validationT('licenseNumberRequired');
    } else if (formData.licenseNumber.length < 3) {
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
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = validationT('firstNameMinLength');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = validationT('lastNameRequired');
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = validationT('lastNameMinLength');
    }

    setErrors(newErrors);
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
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('title')}</h2>
          <p className={styles.subtitle}>
            {t('subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="licenseNumber" className={styles.label}>
                {t('licenseNumber')} *
              </label>
              <input
                id="licenseNumber"
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                className={`${styles.input} ${errors.licenseNumber ? styles.inputError : ''}`}
                placeholder={t('licenseNumberPlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.licenseNumber ? 'licenseNumber-error' : undefined}
              />
              {errors.licenseNumber && (
                <span id="licenseNumber-error" className={styles.error} role="alert">
                  {errors.licenseNumber}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="licenseType" className={styles.label}>
                {t('licenseType')} *
              </label>
              <select
                id="licenseType"
                value={formData.licenseType}
                onChange={(e) => handleInputChange('licenseType', e.target.value)}
                className={`${styles.select} ${errors.licenseType ? styles.inputError : ''}`}
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
                <span id="licenseType-error" className={styles.error} role="alert">
                  {errors.licenseType}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="state" className={styles.label}>
                {t('state')} *
              </label>
              <select
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className={`${styles.select} ${errors.state ? styles.inputError : ''}`}
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
                <span id="state-error" className={styles.error} role="alert">
                  {errors.state}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="firstName" className={styles.label}>
                {t('firstName')} *
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                placeholder={t('firstNamePlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              />
              {errors.firstName && (
                <span id="firstName-error" className={styles.error} role="alert">
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="lastName" className={styles.label}>
                {t('lastName')} *
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                placeholder={t('lastNamePlaceholder')}
                disabled={isLoading}
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              />
              {errors.lastName && (
                <span id="lastName-error" className={styles.error} role="alert">
                  {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
              aria-describedby="submit-help"
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true"></span>
                  {t('verifyingButton')}
                </>
              ) : (
                t('verifyButton')
              )}
            </button>
            <p id="submit-help" className={styles.helpText}>
              {t('helpText')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}