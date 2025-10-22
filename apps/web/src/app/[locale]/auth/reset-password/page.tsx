'use client';

import { useState, useEffect, Suspense } from 'react';
import { confirmResetPassword } from '@packages/auth';
import { Button, Card, Input } from 'ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Dumbbell,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [username, setUsername] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  useEffect(() => {
    const usernameParam = searchParams.get('username');
    const code = searchParams.get('code');

    if (usernameParam) setUsername(usernameParam);
    if (code) setConfirmationCode(code);

    // Only set username from URL, let user enter verification code manually
    if (!usernameParam) {
      // If no username in URL, user might have navigated directly
      // They'll need to enter both username and verification code
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'username') {
      setUsername(value);
    } else if (name === 'confirmationCode') {
      setConfirmationCode(value);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      await confirmResetPassword({
        username,
        confirmationCode,
        newPassword: formData.password,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
            Password Reset Successful!
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Your password has been successfully reset. You can now sign in with
            your new password.
          </p>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Redirecting to sign in page in 3 seconds...
            </p>

            <Link href="/auth/signin">
              <Button variant="primary" className="w-full">
                Sign In Now
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
            <Lock className="h-16 w-16 mb-4" />
          </div>
          <h1 className="text-4xl font-bold mb-6">Create New Password</h1>
          <p className="text-xl text-blue-100 mb-8">
            Choose a strong password to keep your fitness data secure and
            continue your journey.
          </p>

          <div className="bg-white/20 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Password Requirements</h3>
            <ul className="text-left space-y-2 text-blue-100">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                At least 8 characters long
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Include uppercase & lowercase
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Include numbers
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Include special characters
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
            <div className="flex items-center mb-6 lg:hidden">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Reset Your Password
            </h1>
            <p className="text-gray-600">
              Enter your new password below to complete the reset process.
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

              {/* Username Field - only show if not in URL */}
              {!searchParams.get('username') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username or Email
                  </label>
                  <Input
                    type="text"
                    name="username"
                    value={username}
                    onChange={handleChange}
                    required
                    placeholder="Enter your username or email"
                    className="w-full"
                  />
                </div>
              )}

              {/* Verification Code Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <Input
                  type="text"
                  name="confirmationCode"
                  value={confirmationCode}
                  onChange={handleChange}
                  required
                  placeholder="Enter the 6-digit code from your email"
                  className="w-full"
                  maxLength={6}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Check your email for the verification code we sent you.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your new password"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Confirm your new password"
                    className="w-full pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Password Strength:
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`text-xs flex items-center ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${formData.password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}
                      ></div>
                      At least 8 characters
                    </div>
                    <div
                      className={`text-xs flex items-center ${/[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${/[A-Z]/.test(formData.password) && /[a-z]/.test(formData.password) ? 'bg-green-500' : 'bg-gray-300'}`}
                      ></div>
                      Uppercase & lowercase letters
                    </div>
                    <div
                      className={`text-xs flex items-center ${/\d/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${/\d/.test(formData.password) ? 'bg-green-500' : 'bg-gray-300'}`}
                      ></div>
                      Numbers
                    </div>
                    <div
                      className={`text-xs flex items-center ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'bg-green-500' : 'bg-gray-300'}`}
                      ></div>
                      Special characters
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={
                  !username || !confirmationCode || formData.password.length < 8
                }
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
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
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
