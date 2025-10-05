'use client';

import { useState } from 'react';
import { resetPassword } from '../../../../../../packages/auth/dist';
import { Button, Card, Input } from '../../../../../../packages/ui/dist';
import Link from 'next/link';
import {
  Dumbbell,
  ArrowLeft,
  Mail,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await resetPassword({ username: email });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send reset email'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-xl border-0 text-center">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Check Your Email
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We've sent a 6-digit verification code to <strong>{email}</strong>.
            Use this code along with your new password to complete the reset
            process.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Next steps:</strong> Go to the{' '}
              <Link
                href="/auth/reset-password"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                password reset page
              </Link>{' '}
              and enter your verification code along with your new password.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Didn't receive the email? Check your spam folder or try again.
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSuccess(false)}
            >
              Try Again
            </Button>

            <Link href="/auth/signin">
              <Button variant="primary" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-600 items-center justify-center p-12">
        <div className="text-center text-white max-w-md">
          <div className="flex items-center justify-center mb-8">
            <Mail className="h-16 w-16 mb-4" />
          </div>
          <h1 className="text-4xl font-bold mb-6">Reset Your Password</h1>
          <p className="text-xl text-blue-100 mb-8">
            Don't worry, it happens to the best of us. We'll help you get back
            to your fitness journey.
          </p>

          <div className="bg-white/20 rounded-lg p-6">
            <h3 className="font-semibold mb-3">What happens next?</h3>
            <ul className="text-left space-y-2 text-blue-100">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Check your email inbox
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Find the 6-digit verification code
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Enter code and new password
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Continue your fitness journey
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Side - Reset Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Link>

            <div className="flex items-center mb-6 lg:hidden">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h1>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>

          <Card className="p-8 shadow-xl border-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-2">
                  We'll send a password reset link to this email address.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Remember your password?{' '}
                <Link
                  href="/auth/signin"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Having trouble? Contact our{' '}
              <Link
                href="/support"
                className="text-blue-600 hover:text-blue-700"
              >
                support team
              </Link>{' '}
              for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
