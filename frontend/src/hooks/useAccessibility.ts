/**
 * React hook for managing accessibility features and preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { TIMING } from '@/constants';

interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  darkMode: boolean;
  largeText: boolean;
  announcements: boolean;
}

interface UseAccessibilityReturn {
  preferences: AccessibilityPreferences;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  setHighContrast: (enabled: boolean) => void;
  setLargeText: (enabled: boolean) => void;
  focusElement: (selector: string) => void;
  trapFocus: (containerSelector: string) => () => void;
}

const STORAGE_KEY = 'accessibility-preferences';

export function useAccessibility(): UseAccessibilityReturn {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    reducedMotion: false,
    highContrast: false,
    darkMode: false,
    largeText: false,
    announcements: true,
  });

  // Initialize preferences from system and localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect system preferences
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Load saved preferences
    const savedPreferences = localStorage.getItem(STORAGE_KEY);
    const userPreferences = savedPreferences ? JSON.parse(savedPreferences) : {};

    const newPreferences: AccessibilityPreferences = {
      reducedMotion: userPreferences.reducedMotion ?? reducedMotion,
      highContrast: userPreferences.highContrast ?? highContrast,
      darkMode: userPreferences.darkMode ?? darkMode,
      largeText: userPreferences.largeText ?? false,
      announcements: userPreferences.announcements ?? true,
    };

    setPreferences(newPreferences);
    applyPreferences(newPreferences);
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    applyPreferences(preferences);
  }, [preferences]);

  // Apply preferences to document
  const applyPreferences = useCallback((prefs: AccessibilityPreferences) => {
    if (typeof window === 'undefined') return;

    const { documentElement } = document;

    // Apply CSS classes for styling
    documentElement.classList.toggle('reduced-motion', prefs.reducedMotion);
    documentElement.classList.toggle('high-contrast', prefs.highContrast);
    documentElement.classList.toggle('dark-mode', prefs.darkMode);
    documentElement.classList.toggle('large-text', prefs.largeText);

    // Set CSS custom properties
    documentElement.style.setProperty(
      '--animation-duration',
      prefs.reducedMotion ? '0.01ms' : '250ms'
    );

    documentElement.style.setProperty(
      '--transition-duration',
      prefs.reducedMotion ? '0.01ms' : '150ms'
    );

    if (prefs.largeText) {
      documentElement.style.setProperty('--base-font-size', '1.125rem');
    } else {
      documentElement.style.setProperty('--base-font-size', '1rem');
    }
  }, []);

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (!preferences.announcements || typeof window === 'undefined') return;

    // Create or get existing live region
    let liveRegion = document.getElementById(`live-region-${priority}`);
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = `live-region-${priority}`;
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // Clear and set new message
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion!.textContent = message;
    }, TIMING.ACCESSIBILITY_DEBOUNCE);

    // Clean up after announcement
    setTimeout(() => {
      liveRegion!.textContent = '';
    }, TIMING.SUCCESS_MESSAGE_DURATION);
  }, [preferences.announcements]);

  // Set high contrast mode
  const setHighContrast = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, highContrast: enabled }));
    announceToScreenReader(
      enabled ? 'High contrast mode enabled' : 'High contrast mode disabled'
    );
  }, [announceToScreenReader]);

  // Set large text mode
  const setLargeText = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, largeText: enabled }));
    announceToScreenReader(
      enabled ? 'Large text mode enabled' : 'Large text mode disabled'
    );
  }, [announceToScreenReader]);

  // Focus management
  const focusElement = useCallback((selector: string) => {
    if (typeof window === 'undefined') return;

    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
    }
  }, []);

  // Focus trap for modals/dialogs
  const trapFocus = useCallback((containerSelector: string) => {
    if (typeof window === 'undefined') return () => {};

    const container = document.querySelector(containerSelector) as HTMLElement;
    if (!container) return () => {};

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Find and focus the element that opened the modal
        const trigger = document.querySelector('[aria-expanded="true"]') as HTMLElement;
        if (trigger) {
          trigger.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscapeKey);

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  return {
    preferences,
    announceToScreenReader,
    setHighContrast,
    setLargeText,
    focusElement,
    trapFocus,
  };
}

/**
 * Hook for managing keyboard navigation
 */
export function useKeyboardNavigation() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip links navigation (Alt + S)
      if (event.altKey && event.key === 's') {
        event.preventDefault();
        const skipLink = document.querySelector('.skip-link') as HTMLElement;
        if (skipLink) {
          skipLink.focus();
        }
      }

      // Main content navigation (Alt + M)
      if (event.altKey && event.key === 'm') {
        event.preventDefault();
        const mainContent = document.querySelector('main') as HTMLElement;
        if (mainContent) {
          mainContent.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Hook for managing ARIA announcements
 */
export function useAriaAnnouncements() {
  const { announceToScreenReader } = useAccessibility();

  const announceFormError = useCallback((fieldName: string, error: string) => {
    announceToScreenReader(`Error in ${fieldName}: ${error}`, 'assertive');
  }, [announceToScreenReader]);

  const announceFormSuccess = useCallback((message: string) => {
    announceToScreenReader(message, 'polite');
  }, [announceToScreenReader]);

  const announcePageChange = useCallback((pageName: string) => {
    announceToScreenReader(`Navigated to ${pageName}`, 'polite');
  }, [announceToScreenReader]);

  const announceLoadingState = useCallback((isLoading: boolean, context?: string) => {
    const message = isLoading 
      ? `Loading${context ? ` ${context}` : ''}...`
      : `Loading complete${context ? ` for ${context}` : ''}`;
    
    announceToScreenReader(message, 'polite');
  }, [announceToScreenReader]);

  return {
    announceFormError,
    announceFormSuccess,
    announcePageChange,
    announceLoadingState,
  };
}