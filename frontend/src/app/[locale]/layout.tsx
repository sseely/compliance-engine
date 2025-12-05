import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.scss';
import { locales, type Locale } from '@/i18n/config';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { LanguageTracker } from '@/components/LanguageTracker';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  
  return {
    title: `${t('title')} - Compliance Engine`,
    description: t('subtitle'),
    keywords: 'license verification, professional credentials, compliance, medical license, nursing license',
    authors: [{ name: 'Compliance Engine Team' }],
    robots: 'index, follow',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;
  
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AccessibilityProvider>
            <LanguageTracker />
            {/* Skip navigation links */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <a href="#navigation" className="skip-link">
              Skip to navigation
            </a>
            
            {/* Main application structure */}
            <div className="app-layout">
              <header id="navigation" role="banner">
                {/* Navigation will be added when we implement auth */}
              </header>
              
              <main id="main-content" role="main" tabIndex={-1}>
                {children}
              </main>
              
              <footer role="contentinfo">
                {/* Footer content will be added later */}
              </footer>
            </div>
          </AccessibilityProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}