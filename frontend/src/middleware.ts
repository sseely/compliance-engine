import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

// Create and export the i18n middleware directly
export default createMiddleware({
  // A list of all locales that are supported
  locales,
  
  // Used when no locale matches
  defaultLocale,
  
  // Prefix for all locales
  localePrefix: 'as-needed'
});

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
    // Exclude OAuth callback routes, API routes, and static files
    '/((?!_next|_vercel|auth|api|.*\\..*).*)'
  ]
};