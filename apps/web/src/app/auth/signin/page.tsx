'use client';

import { useState } from 'react';
// import { Button } from '../../components/ui/Button';
// import { Card } from '../../components/ui/Card';
// import { Input } from '../../components/ui/Input';
// import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dumbbell, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { signIn, fetchAuthSession } from '@packages/auth';
import Cookies from 'js-cookie';

export default function SignInPage() {
  const router = useRouter();
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
      await signIn({
        username: username,
        password,
      });

      // Get the session and store the token
      const session = await fetchAuthSession();
      const jwt = session.tokens?.accessToken?.toString();

      if (jwt) {
        Cookies.set('access_token', jwt, {
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sign_in_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-600 items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <div className="flex items-center justify-center mb-8">
            <Dumbbell className="h-16 w-16 mb-4" />
          </div>
          <h1 className="text-4xl font-bold mb-6">Welcome Back!</h1>
          <p className="text-xl text-blue-100 mb-8">
            Sign in to continue your fitness journey
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white/20 rounded-lg p-4">
              <div className="font-semibold mb-1">Smart Workouts</div>
              <div className="text-blue-100">AI-generated plans</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="font-semibold mb-1">Progress Tracking</div>
              <div className="text-blue-100">Real-time analytics</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="font-semibold mb-1">Nutrition Guide</div>
              <div className="text-blue-100">Meal planning</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="font-semibold mb-1">Sleep Monitor</div>
              <div className="text-blue-100">Recovery insights</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>

            <div className="flex items-center mb-6 lg:hidden">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('welcome_back')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('sign_in_to_account')}
            </p>
          </div>

          {/* Sign In Form */}
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('username_or_email')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('enter_username_email')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enter_password')}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {/* Password strength indicator */}
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-1">
                    <div
                      className="h-1 rounded transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (password.length / 8) * 100)}%`,
                        backgroundColor:
                          password.length < 4
                            ? '#ef4444'
                            : password.length < 6
                              ? '#f59e0b'
                              : password.length < 8
                                ? '#10b981'
                                : '#059669',
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                    {password.length < 4
                      ? 'Weak'
                      : password.length < 6
                        ? 'Fair'
                        : password.length < 8
                          ? 'Good'
                          : 'Strong'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    {t('remember_me')}
                  </span>
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('forgot_password')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading && (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {isLoading ? t('signing_in') : t('sign_in')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-300">
                {t('dont_have_account')}{' '}
                <Link
                  href="/auth/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('sign_up_for_free')}
                </Link>
              </p>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
              <p>
                {t('by_signing_in')}{' '}
                <Link
                  href="/terms"
                  className="text-blue-600 hover:text-blue-700"
                >
                  {t('terms_of_service')}
                </Link>{' '}
                {t('and')}{' '}
                <Link
                  href="/privacy"
                  className="text-blue-600 hover:text-blue-700"
                >
                  {t('privacy_policy')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
