'use client';

import { useState, Suspense } from 'react';
import {
  confirmSignUp,
  resendSignUpCode,
} from '../../../../../../packages/auth/dist';
import { Button, Card, Input } from '../../../../../../packages/ui/dist';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function CodeVerificationForm() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      await confirmSignUp({ username: username!, confirmationCode: code });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await resendSignUpCode({ username: username! });
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-success-600 mb-4">
            Account Verified!
          </h1>
          <p className="text-secondary-600 mb-6">
            Your account has been successfully verified. You can now sign in.
          </p>
          <Link
            href="/auth/signin"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Go to Sign In
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-2">
            Verify Your Account
          </h1>
          <p className="text-secondary-600">
            Enter the verification code sent to your email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {resendSuccess && (
            <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg">
              Verification code resent! Please check your email.
            </div>
          )}

          <Input
            label="Verification Code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Enter the code"
          />

          <div className="flex items-center justify-between">
            <Button type="submit" loading={isLoading} className="w-full mr-2">
              Verify
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={resendLoading}
              onClick={handleResend}
              className="w-full ml-2"
            >
              Resend Code
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/signin"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function CodeVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <CodeVerificationForm />
    </Suspense>
  );
}
