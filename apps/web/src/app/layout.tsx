import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from 'next-themes';
import { ClientAuthWrapper } from '../components/auth/ClientAuthWrapper';
import { NotificationInitializer } from '../components/NotificationInitializer';
import LocaleProvider from '../components/LocaleProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GymCoach AI',
  description: 'Your intelligent fitness companion powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load messages for the default locale
  const messages = require('../../messages/en.json');

  return (
    <html lang="en" suppressHydrationWarning>
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
                    if (storedTheme === 'dark') {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } else if (!storedTheme) {
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
              <LocaleProvider messages={messages} locale="en">
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
