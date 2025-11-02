import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

// Create the base i18n middleware
const handleI18nRouting = createMiddleware({
  // A list of all locales that are supported
  locales,
  
  // Used when no locale matches
  defaultLocale,
  
  // Prefix for all locales
  localePrefix: 'as-needed'
});

// Extended middleware that tracks unsupported language requests and handles i18n routing  
export default async function middleware(request: NextRequest) {
  // Get the user's preferred languages from Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  
  if (acceptLanguage) {
    const preferredLanguages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().toLowerCase())
      .filter(lang => lang.length >= 2);
    
    // Check each preferred language to see if any are unsupported
    for (const language of preferredLanguages) {
      const normalizedLang = language.includes('-') ? language : language.substring(0, 2);
      
      // If this language preference is not supported, track it
      if (!locales.includes(normalizedLang as any) && normalizedLang.length >= 2) {
        // Track asynchronously to not block the request
        // Server-side session deduplication will prevent duplicate votes
        trackLanguageRequest(normalizedLang, request).catch(() => {
          // Silently fail - tracking shouldn't break user experience
        });
        break; // Only track the first unsupported language preference
      }
    }
  }
  
  // Continue with normal i18n routing (this will default to English for unsupported languages)
  return handleI18nRouting(request);
}

async function trackLanguageRequest(languageCode: string, request: NextRequest) {
  try {
    // Call our analytics API to increment the vote count for this language
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/analytics/language-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language_code: languageCode,
        user_agent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer')
      })
    });
    
    // If successful, the server will handle session deduplication
    // The client-side cookie check is just an optimization to reduce API calls
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

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',
    
    // Set a cookie to remember the previous locale for
    // all requests that have a locale prefix
    '/(es|en)/:path*',
    
    // Enable redirects that add missing locales
    // (e.g. `/pathnames` -> `/en/pathnames`)
    '/((?!_next|_vercel|.*\\..*).*)'
  ]
};