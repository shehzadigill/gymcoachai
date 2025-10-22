'use client';

import { useState } from 'react';
import { signUp } from '@packages/auth';
import { Button, Card, Input } from 'ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Dumbbell,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

export default function SignUpPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    fitnessGoals: 'Build muscle, lose weight, improve endurance',
    experienceLevel: 'beginner',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwords_no_match'));
      setIsLoading(false);
      return;
    }

    try {
      await signUp({
        username: formData.username,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            given_name: formData.firstName,
            family_name: formData.lastName,
            'custom:fitnessGoals': formData.fitnessGoals,
            'custom:experienceLevel': formData.experienceLevel,
          },
        },
      });

      setSuccess(true);
      const verificationPath =
        locale === 'en'
          ? `/auth/codeVerification?username=${formData.username}`
          : `/${locale}/auth/codeVerification?username=${formData.username}`;
      router.push(verificationPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signup_error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8 shadow-xl border-0">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('check_email_title')}
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            {t('check_email_message')} <strong>{formData.email}</strong>.{' '}
            {t('check_email_instruction')}
          </p>

          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                const verificationPath =
                  locale === 'en'
                    ? `/auth/codeVerification?username=${formData.username}`
                    : `/${locale}/auth/codeVerification?username=${formData.username}`;
                router.push(verificationPath);
              }}
            >
              {t('verify_account')}
            </Button>

            <Link
              href={locale === 'en' ? '/auth/signin' : `/${locale}/auth/signin`}
              className="block text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('back_to_signin')}
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
            <Dumbbell className="h-16 w-16 mb-4" />
          </div>
          <h1 className="text-4xl font-bold mb-6">
            {t('start_fitness_journey')}
          </h1>
          <p className="text-xl text-blue-100 mb-8">{t('join_thousands')}</p>

          <div className="space-y-4">
            <div className="flex items-center text-left bg-white/20 rounded-lg p-4">
              <Target className="h-6 w-6 mr-3 flex-shrink-0" />
              <div>
                <div className="font-semibold">{t('personalized_plans')}</div>
                <div className="text-blue-100 text-sm">
                  {t('personalized_plans_desc')}
                </div>
              </div>
            </div>

            <div className="flex items-center text-left bg-white/20 rounded-lg p-4">
              <TrendingUp className="h-6 w-6 mr-3 flex-shrink-0" />
              <div>
                <div className="font-semibold">{t('track_progress')}</div>
                <div className="text-blue-100 text-sm">
                  {t('track_progress_desc')}
                </div>
              </div>
            </div>

            <div className="flex items-center text-left bg-white/20 rounded-lg p-4">
              <Users className="h-6 w-6 mr-3 flex-shrink-0" />
              <div>
                <div className="font-semibold">{t('join_community')}</div>
                <div className="text-blue-100 text-sm">
                  {t('join_community_desc')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <Link
              href={locale === 'en' ? '/' : `/${locale}`}
              className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back_to_home')}
            </Link>

            <div className="flex items-center mb-6 lg:hidden">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('signup_title')}
            </h1>
            <p className="text-gray-600">{t('signup_subtitle')}</p>
          </div>

          <Card className="p-8 shadow-xl border-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('first_name')}
                  </label>
                  <Input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    placeholder={t('first_name_placeholder')}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('last_name')}
                  </label>
                  <Input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    placeholder={t('last_name_placeholder')}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('username')}
                </label>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder={t('username_placeholder_signup')}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('email')}
                </label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={t('email_placeholder')}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('password')}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Create a strong password"
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
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Confirm your password"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fitness Goals
                </label>
                <Input
                  name="fitnessGoals"
                  value={formData.fitnessGoals}
                  onChange={handleChange}
                  placeholder="e.g., Build muscle, lose weight, improve endurance"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Experience Level
                </label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="beginner">
                    🌱 Beginner - Just getting started
                  </option>
                  <option value="intermediate">
                    💪 Intermediate - Some experience
                  </option>
                  <option value="advanced">
                    🏆 Advanced - Very experienced
                  </option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? t('creating_account') : t('create_account_button')}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
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
