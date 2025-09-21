'use client';

import { useState } from 'react';
import { signIn } from '../../../../../../packages/auth/dist';
import { Button, Card, Input } from '../../../../../../packages/ui/dist';
import { PasswordStrength } from '../../../../../../packages/ui/dist';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from '../../../../../../packages/auth/dist';
import Cookies from 'js-cookie';

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState('rehanbhattisweden');
  const [password, setPassword] = useState('Rehan@123');
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-secondary-600">
            Sign in to your GymCoach AI account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter your username"
          />

          <div className="space-y-2">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
            <PasswordStrength password={password} />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className="w-full"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-secondary-600">
            Don't have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-secondary-500 hover:text-secondary-700"
          >
            Forgot your password?
          </Link>
        </div>
      </Card>
    </div>
  );
}
