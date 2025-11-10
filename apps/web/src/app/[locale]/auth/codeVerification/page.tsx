'use client';

import { useState, Suspense } from 'react';
import { confirmSignUp, resendSignUpCode } from '@packages/auth';
import { Button, Card, Input } from 'ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

function CodeVerificationForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
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
      setError(err instanceof Error ? err.message : t('verification_failed'));
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
      setError(err instanceof Error ? err.message : t('resend_failed'));
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-success-600 mb-4">
            {t('account_verified')}
          </h1>
          <p className="text-secondary-600 mb-6">
            {t('account_verified_message')}
          </p>
          <Link
            href={`/${locale}/auth/signin`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {t('go_to_signin')}
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
            {t('verify_account_title')}
          </h1>
          <p className="text-secondary-600">{t('verify_account_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {resendSuccess && (
            <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg">
              {t('verification_code_resent')}
            </div>
          )}

          <Input
            label={t('verification_code_label')}
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder={t('verification_code_input_placeholder')}
          />

          <div className="flex items-center justify-between">
            <Button type="submit" loading={isLoading} className="w-full mr-2">
              {t('verify_button')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={resendLoading}
              onClick={handleResend}
              className="w-full ml-2"
            >
              {t('resend_code')}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link
            href={`/${locale}/auth/signin`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {t('back_to_signin')}
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
