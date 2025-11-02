/**
 * Middleware to ensure only platform admins can access auth verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function adminAuthMiddleware(req: NextRequest) {
  // Get the token from the request
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  // Check if user is authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  // Check if user has platform admin role
  // This would typically check against your user database
  const isPlatformAdmin = token.role === 'platform_admin' || 
                         token.email?.endsWith('@your-company.com') ||
                         process.env.PLATFORM_ADMIN_EMAILS?.split(',').includes(token.email as string);

  if (!isPlatformAdmin) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}

// Apply this middleware to admin routes
export const config = {
  matcher: [
    '/admin/auth-verification/:path*',
    '/api/auth-verification/:path*'
  ]
};