'use client';

import { useEffect } from 'react';
import { locales } from '@/i18n/config';
import { VALIDATION_RULES, API_CONFIG } from '@/constants';

/**
 * Client-side component that tracks unsupported language requests
 * based on the user's browser preferences
 */
export function LanguageTracker() {
  useEffect(() => {
    // Only run on the client side
    if (typeof window === 'undefined') return;

    // Check if we've already tracked a language request this session
    const sessionKey = 'language_request_tracked';
    if (sessionStorage.getItem(sessionKey)) {
      return; // Already tracked this session
    }

    // Get user's preferred languages from navigator
    const preferredLanguages = navigator.languages || [navigator.language];
    
    // Check each preferred language to see if any are unsupported
    for (const language of preferredLanguages) {
      const normalizedLang = language.toLowerCase().includes('-') 
        ? language.toLowerCase().split('-')[0] 
        : language.toLowerCase();
      
      // If this language preference is not supported, track it
      if (!locales.includes(normalizedLang as any) && normalizedLang.length >= VALIDATION_RULES.LANGUAGE_CODE_MIN_LENGTH) {
        // Track asynchronously
        trackLanguageRequest(normalizedLang).then(() => {
          // Mark as tracked for this session
          sessionStorage.setItem(sessionKey, 'true');
        }).catch(() => {
          // Silently fail - tracking shouldn't break user experience
        });
        break; // Only track the first unsupported language preference
      }
    }
  }, []);

  // This component doesn't render anything
  return null;
}

async function trackLanguageRequest(languageCode: string) {
  try {
    // Call our analytics API to increment the vote count for this language
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_CONFIG.DEFAULT_BASE_URL}/api/v1/analytics/language-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language_code: languageCode,
        user_agent: navigator.userAgent,
        referrer: document.referrer
      })
    });
    
    if (response.ok) {
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.log(`Tracked unsupported language request: ${languageCode}`);
      }
    }
  } catch (error) {
    // Silently fail - tracking shouldn't break user experience
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to track language request:', error);
    }
  }
}