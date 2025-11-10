'use client';

import { useState } from 'react';
import { resetPassword } from '@packages/auth';
import { Button, Card, Input } from 'ui';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Dumbbell,
  ArrowLeft,
  Mail,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
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
      setError(err instanceof Error ? err.message : t('reset_error'));
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
            {t('check_email_reset_title')}
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            {t('check_email_reset_message')} <strong>{email}</strong>.
            {t('check_email_reset_instruction')}
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>{t('next_steps')}</strong> {t('go_to_reset_page')}{' '}
              <Link
                href={`/${locale}/auth/reset-password`}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                {t('password_reset_page')}
              </Link>{' '}
              {t('enter_code_password_instruction')}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('didnt_receive_email')}</p>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSuccess(false)}
            >
              {t('try_again')}
            </Button>

            <Link href={`/${locale}/auth/signin`}>
              <Button variant="primary" className="w-full">
                {t('back_to_signin_button')}
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
          <h1 className="text-4xl font-bold mb-6">
            {t('reset_password_title')}
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            {t('reset_password_subtitle')}
          </p>

          <div className="bg-white/20 rounded-lg p-6">
            <h3 className="font-semibold mb-3">{t('what_happens_next')}</h3>
            <ul className="text-left space-y-2 text-blue-100">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                {t('check_email_inbox')}
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                {t('find_verification_code')}
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                {t('enter_code_password')}
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                {t('continue_fitness_journey')}
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
              href={`/${locale}/auth/signin`}
              className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back_to_signin')}
            </Link>

            <div className="flex items-center mb-6 lg:hidden">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('forgot_password_title')}
            </h1>
            <p className="text-gray-600">{t('forgot_password_subtitle')}</p>
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
                  {t('email_address')}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('email_placeholder_forgot')}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {t('email_instruction')}
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? t('sending_reset_link') : t('send_reset_link')}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                {t('remember_password')}{' '}
                <Link
                  href={`/${locale}/auth/signin`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('signin_here')}
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              {t('contact_support')}{' '}
              <Link
                href={`/${locale}/support`}
                className="text-blue-600 hover:text-blue-700"
              >
                {t('support_team')}
              </Link>{' '}
              {t('for_assistance')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
