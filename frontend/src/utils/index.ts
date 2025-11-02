// Shared utility functions for the compliance engine frontend

import type { LicenseStatus, DisciplinaryStatus } from '@/types';
import { CONFIDENCE_THRESHOLDS } from '@/constants';

/**
 * Gets the appropriate CSS class for a status badge based on status
 */
export const getStatusBadgeClass = (status: LicenseStatus | DisciplinaryStatus, styles: Record<string, string>): string => {
  switch (status) {
    case 'active':
      return styles.statusSuccess;
    case 'pending':
      return styles.statusWarning;
    case 'expired':
    case 'suspended':
    case 'revoked':
      return styles.statusError;
    case 'resolved':
      return styles.statusSuccess;
    default:
      return styles.statusNeutral;
  }
};

/**
 * Gets the appropriate color for confidence display based on confidence level
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'var(--color-success)';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'var(--color-warning)';
  return 'var(--color-error)';
};

/**
 * Formats a date string for display
 */
export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};