// Internationalization utility functions

import { useTranslations } from 'next-intl';
import { LICENSE_TYPE_KEYS, US_STATE_CODES } from '@/constants';

/**
 * Hook to get translated license type options
 */
export function useLicenseTypeOptions() {
  const t = useTranslations('verification.licenseTypes');
  
  return [
    { value: '', label: t('selectType') },
    ...LICENSE_TYPE_KEYS.map(key => ({
      value: key,
      label: t(key)
    }))
  ];
}

/**
 * Hook to get translated US state options
 */
export function useStateOptions() {
  const t = useTranslations('states');
  
  return [
    { value: '', label: t('selectState') },
    ...US_STATE_CODES.map(code => ({
      value: code,
      label: t(code)
    }))
  ];
}

/**
 * Hook to get translated status display text
 */
export function useStatusTranslation() {
  const t = useTranslations('verification.status');
  
  return (status: string) => t(status);
}