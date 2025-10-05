'use client';

import { useState } from 'react';
import { signIn } from '../../../../../../packages/auth/dist';
import { Button, Card, Input } from '../../../../../../packages/ui/dist';
import { PasswordStrength } from '../../../../../../packages/ui/dist';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from '../../../../../../packages/auth/dist';
import Cookies from 'js-cookie';
import { Dumbbell, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
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
      // Set access_token cookie for middleware
      const session = await fetchAuthSession();
      const jwt = session.tokens?.accessToken?.toString();
      if (jwt) {
        Cookies.set('access_token', jwt, {
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        });
      }
      // Redirect to dashboard or home page
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
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
          <h1 className="text-4xl font-bold mb-6">
            Welcome Back to GymCoach AI
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Continue your fitness journey with your AI-powered personal trainer.
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
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-600">
              Sign in to continue your fitness journey
            </p>
          </div>

          <Card className="p-8 shadow-xl border-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username or Email
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter your username or email"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Remember me
                  </span>
                </label>

                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link
                  href="/auth/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up for free
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-blue-600 hover:text-blue-700"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
