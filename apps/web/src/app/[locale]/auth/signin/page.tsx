'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dumbbell, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { signIn, fetchAuthSession } from '@packages/auth';
import Cookies from 'js-cookie';

export default function SignInPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Sign in with AWS Amplify
      const result = await signIn({
        username,
        password,
      });

      if (result.isSignedIn) {
        // Get the auth session to extract tokens
        const session = await fetchAuthSession();

        if (session.tokens?.accessToken) {
          // Store the access token in a cookie for API calls
          Cookies.set('access_token', session.tokens.accessToken.toString(), {
            expires: 1, // 1 day
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
          });
        }

        // Redirect to dashboard with locale-aware path (always include locale)
        // This ensures users end up at /[locale]/dashboard instead of /dashboard
        const dashboardPath = `/${locale}/dashboard`;
        router.push(dashboardPath);
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An error occurred during sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-indigo-600 p-3 rounded-full">
              <Dumbbell className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('signin_title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{t('signin_subtitle')}</p>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link
            href={locale === 'en' ? '/' : `/${locale}`}
            className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back_to_home')}
          </Link>
        </div>

        {/* Sign In Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                {t('username_label')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder={t('username_placeholder')}
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                {t('password_label')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder={t('password_placeholder')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('signing_in')}
                </div>
              ) : (
                t('signin_button')
              )}
            </button>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              {t('no_account')}{' '}
              <Link
                href={
                  locale === 'en' ? '/auth/signup' : `/${locale}/auth/signup`
                }
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                {t('signup_link')}
              </Link>
            </p>
          </div>

          {/* Forgot Password Link */}
          <div className="text-center">
            <Link
              href={
                locale === 'en'
                  ? '/auth/forgot-password'
                  : `/${locale}/auth/forgot-password`
              }
              className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {t('forgot_password')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
