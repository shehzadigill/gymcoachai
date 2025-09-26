import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from 'next-themes';

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
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
