'use client';

import { useState } from 'react';
import styles from './LicenseVerificationForm.module.scss';
import type { FormData, FormErrors, LicenseVerificationFormProps } from '@/types';
import { LICENSE_TYPES, US_STATES } from '@/constants';

export default function LicenseVerificationForm({ onSubmit, isLoading = false }: LicenseVerificationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    licenseNumber: '',
    licenseType: '',
    state: '',
    firstName: '',
    lastName: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    } else if (formData.licenseNumber.length < 3) {
      newErrors.licenseNumber = 'License number must be at least 3 characters';
    }

    if (!formData.licenseType) {
      newErrors.licenseType = 'License type is required';
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
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
          <h2 className={styles.title}>License Verification</h2>
          <p className={styles.subtitle}>
            Enter license information to verify professional credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="licenseNumber" className={styles.label}>
                License Number *
              </label>
              <input
                id="licenseNumber"
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                className={`${styles.input} ${errors.licenseNumber ? styles.inputError : ''}`}
                placeholder="Enter license number"
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
                License Type *
              </label>
              <select
                id="licenseType"
                value={formData.licenseType}
                onChange={(e) => handleInputChange('licenseType', e.target.value)}
                className={`${styles.select} ${errors.licenseType ? styles.inputError : ''}`}
                disabled={isLoading}
                aria-describedby={errors.licenseType ? 'licenseType-error' : undefined}
              >
                {LICENSE_TYPES.map(option => (
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
                State *
              </label>
              <select
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className={`${styles.select} ${errors.state ? styles.inputError : ''}`}
                disabled={isLoading}
                aria-describedby={errors.state ? 'state-error' : undefined}
              >
                {US_STATES.map(option => (
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
                First Name *
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                placeholder="Enter first name"
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
                Last Name *
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                placeholder="Enter last name"
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
                  Verifying License...
                </>
              ) : (
                'Verify License'
              )}
            </button>
            <p id="submit-help" className={styles.helpText}>
              All fields marked with * are required
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}