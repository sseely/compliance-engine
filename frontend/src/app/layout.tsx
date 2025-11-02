import type { ReactNode } from 'react';

interface RootLayoutProps {
  children: ReactNode;
}

// Since we have a `pages` directory, this serves as the root layout
// for both the main app and localized routes
export default function RootLayout({ children }: RootLayoutProps) {
  return children;
}