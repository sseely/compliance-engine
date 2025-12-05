'use client';

import { ReactNode } from 'react';
import { useAccessibility, useKeyboardNavigation } from '@/hooks/useAccessibility';

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  // Initialize accessibility hooks
  const { preferences, announceToScreenReader } = useAccessibility();
  useKeyboardNavigation();

  return (
    <>
      {children}

      {/* Accessibility controls toolbar (can be toggled with keyboard shortcut) */}
      {/* Wrapped in aside landmark to satisfy axe requirement that all content is in landmarks */}
      <aside aria-label="Accessibility tools">
        <div className="accessibility-toolbar sr-only-focusable" role="toolbar" aria-label="Accessibility controls">
          <button
            type="button"
            onClick={() => announceToScreenReader('Accessibility toolbar opened', 'polite')}
            className="btn btn-secondary"
            aria-label="Accessibility options"
          >
            Accessibility
          </button>
        </div>
      </aside>
    </>
  );
}