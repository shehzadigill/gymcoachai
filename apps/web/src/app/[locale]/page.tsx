'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function Home() {
  const t = useTranslations('common');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                GymCoach AI
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher />
              <Link
                href="/auth/signin"
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              {t('auth.welcome_title')}
            </h1>

            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              {t('auth.welcome_subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 text-lg px-8 py-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                {t('auth.start_journey')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive tools powered by AI to help you achieve your fitness
              goals faster and smarter.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Workouts */}
            <div className="text-center p-8 hover:shadow-lg transition-shadow bg-white rounded-lg border">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('nav.workouts')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                AI-generated workout plans that adapt to your fitness level,
                preferences, and available equipment.
              </p>
            </div>

            {/* Nutrition */}
            <div className="text-center p-8 hover:shadow-lg transition-shadow bg-white rounded-lg border">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('nav.nutrition')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Log meals, track macros, and get personalized nutrition
                recommendations powered by AI.
              </p>
            </div>

            {/* Analytics */}
            <div className="text-center p-8 hover:shadow-lg transition-shadow bg-white rounded-lg border">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('nav.analytics')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Detailed analytics and insights to track your progress and
                optimize your fitness journey.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <span className="text-2xl font-bold">{t('app.title')}</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md mx-auto">
              Your intelligent fitness companion powered by AI. Transform your
              fitness journey with personalized workouts, nutrition tracking,
              and real-time coaching.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
