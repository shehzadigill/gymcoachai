import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { AuthProvider } from '../providers/AuthProvider';
import { ThemeProvider } from 'next-themes';
import { ClientAuthWrapper } from '../../components/auth/ClientAuthWrapper';
import { NotificationInitializer } from '../../components/NotificationInitializer';
import LocaleProvider from '../../components/LocaleProvider';
import { getMessages } from 'next-intl/server';
import { locales } from '../../i18n/config';
import { notFound } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GymCoach AI',
  description: 'Your intelligent fitness companion powered by AI',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const isManual = localStorage.getItem('gymcoach-theme-manual') === 'true';
                  const storedTheme = localStorage.getItem('gymcoach-theme');
                  
                  if (isManual && (storedTheme === 'light' || storedTheme === 'dark')) {
                    // User has manually set preference, use that instead of system
                    if (storedTheme === 'dark') {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } else if (!storedTheme) {
                    // First time visit, follow system preference
                    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (systemPrefersDark) {
                      document.documentElement.classList.add('dark');
                    }
                  }
                } catch (e) {
                  console.warn('Theme initialization error:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          storageKey="gymcoach-theme"
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <ClientAuthWrapper>
              <LocaleProvider messages={messages} locale={locale}>
                <NotificationInitializer />
                {children}
              </LocaleProvider>
            </ClientAuthWrapper>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
