import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

// Root layout for OAuth callback pages
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}