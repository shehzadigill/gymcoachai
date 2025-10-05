'use client';

import { Button, Card, Badge } from '../../../../packages/ui/dist';
import { useCurrentUser, signOut } from '../../../../packages/auth/dist';
import Link from 'next/link';
import {
  Dumbbell,
  Apple,
  BarChart3,
  Brain,
  Smartphone,
  Heart,
  Target,
  TrendingUp,
  Zap,
  Shield,
  Clock,
  Users,
  Star,
  ChevronRight,
  Download,
  Globe,
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, isLoading, name } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                GymCoach AI
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="#features"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Features
              </Link>
              <Link
                href="#mobile"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Mobile App
              </Link>
              <Link
                href="#pricing"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Pricing
              </Link>
            </div>
            <div className="flex gap-3">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button
                      variant="primary"
                      className="flex items-center gap-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button variant="outline">Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="primary">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium">
                <Brain className="h-4 w-4" />
                AI-Powered Fitness Revolution
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Your Personal
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {' '}
                AI Fitness{' '}
              </span>
              Coach
            </h1>

            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transform your fitness journey with intelligent workout plans,
              nutrition tracking, sleep monitoring, and real-time AI coaching.
              Available on web and mobile.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex items-center gap-2 text-lg px-8 py-4 text-primary-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/signup">
                    <Button
                      variant="primary"
                      size="lg"
                      className="flex items-center gap-2 text-lg px-8 py-4"
                    >
                      <Zap className="h-5 w-5" />
                      Start Free Trial
                    </Button>
                  </Link>
                  <Link href="#demo">
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-lg px-8 py-4"
                    >
                      Watch Demo
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Badge variant="success" className="text-sm px-3 py-1">
                🤖 AI-Powered
              </Badge>
              <Badge variant="info" className="text-sm px-3 py-1">
                📱 Cross-Platform
              </Badge>
              <Badge variant="warning" className="text-sm px-3 py-1">
                ⚡ Real-time
              </Badge>
              <Badge variant="default" className="text-sm px-3 py-1">
                🔒 Secure
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
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
            {/* Smart Workouts */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Dumbbell className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Workout Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                AI-generated workout plans that adapt to your fitness level,
                preferences, and available equipment.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/workouts">
                  <Button variant="primary" className="w-full">
                    Start Workout
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="primary" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>

            {/* Nutrition Tracking */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-green-100 dark:bg-green-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Apple className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Nutrition Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Log meals, track macros, and get personalized nutrition
                recommendations powered by AI.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/nutrition">
                  <Button variant="secondary" className="w-full">
                    Track Nutrition
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="secondary" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>

            {/* Sleep Monitoring */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-purple-100 dark:bg-purple-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Sleep Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Monitor sleep patterns, quality, and get insights to optimize
                your recovery and performance.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/sleep">
                  <Button variant="outline" className="w-full">
                    View Sleep Data
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>

            {/* Progress Analytics */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-indigo-100 dark:bg-indigo-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Progress Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Detailed analytics and insights to track your progress and
                optimize your fitness journey.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/analytics">
                  <Button variant="outline" className="w-full">
                    View Analytics
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>

            {/* AI Coaching */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-orange-100 dark:bg-orange-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                AI Coaching
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Get real-time form corrections, motivation, and personalized
                advice from your AI coach.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/coach">
                  <Button variant="outline" className="w-full">
                    Chat with AI
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>

            {/* Performance Metrics */}
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <div className="bg-teal-100 dark:bg-teal-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Performance Metrics
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Track strength gains, endurance improvements, and other key
                performance indicators.
              </p>
              {isAuthenticated ? (
                <Link href="/dashboard/metrics">
                  <Button variant="outline" className="w-full">
                    View Metrics
                  </Button>
                </Link>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section
        id="mobile"
        className="py-20 bg-gradient-to-r from-blue-50 to-indigo-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-4">
                <Smartphone className="h-5 w-5" />
                <span className="font-semibold">Mobile Experience</span>
              </div>

              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Take Your Fitness Anywhere
              </h2>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Our native mobile app brings the full power of GymCoach AI to
                your smartphone. Train anywhere, anytime, with offline support
                and real-time coaching.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Offline workout support
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Real-time form analysis with camera
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Push notifications for workouts
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Sync across all devices
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download for iOS
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download for Android
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-8 text-white text-center">
                <Smartphone className="h-32 w-32 mx-auto mb-6 opacity-20" />
                <h3 className="text-2xl font-bold mb-4">Mobile App Preview</h3>
                <p className="mb-6">
                  Experience the future of fitness coaching in your pocket
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/20 rounded-lg p-3">
                    <Clock className="h-6 w-6 mx-auto mb-2" />
                    <div>Quick Workouts</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <Target className="h-6 w-6 mx-auto mb-2" />
                    <div>Goal Tracking</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                10K+
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Active Users
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                1M+
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Workouts Completed
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                95%
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                User Satisfaction
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                24/7
              </div>
              <div className="text-gray-600 dark:text-gray-400">AI Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section
        id="pricing"
        className="py-20 bg-gradient-to-br from-gray-50 to-blue-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Start free and upgrade when you're ready for advanced AI features.
              No hidden fees, cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="text-center p-8 border-2 border-gray-200 relative">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Free
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Perfect for getting started
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  $0
                </span>
                <span className="text-gray-600 dark:text-gray-300">/month</span>
              </div>
              <ul className="text-left space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Basic workout logging
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Simple nutrition tracking
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Weekly progress reports
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                  Limited to 3 custom workouts
                </li>
              </ul>
              {isAuthenticated ? (
                <Button variant="outline" className="w-full">
                  Current Plan
                </Button>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">
                    Start Free
                  </Button>
                </Link>
              )}
            </Card>

            {/* Premium Plan */}
            <Card className="text-center p-8 border-2 border-blue-500 relative scale-105 shadow-xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge
                  variant="info"
                  className="px-4 py-1 bg-blue-600 text-white"
                >
                  Most Popular
                </Badge>
              </div>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Premium
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Complete AI-powered coaching
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  $19.99
                </span>
                <span className="text-gray-600 dark:text-gray-300">/month</span>
              </div>
              <ul className="text-left space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Unlimited AI workouts
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Real-time form analysis
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Advanced nutrition planning
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Comprehensive sleep analysis
                </li>
              </ul>
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  Upgrade Now
                </Button>
              ) : (
                <Link href="/auth/signup">
                  <Button
                    variant="primary"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    Start 7-Day Free Trial
                  </Button>
                </Link>
              )}
            </Card>

            {/* Enterprise Plan */}
            <Card className="text-center p-8 border-2 border-purple-200 md:col-span-2 lg:col-span-1">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Enterprise
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                For gyms and organizations
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  Custom
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  /pricing
                </span>
              </div>
              <ul className="text-left space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  White-label mobile apps
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Multi-tenant dashboard
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  API access & integrations
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Dedicated support
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-900/20"
              >
                Contact Sales
              </Button>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Need more details? Compare all features and see what's included in
              each plan.
            </p>
            <Link href="/pricing">
              <Button
                variant="outline"
                size="lg"
                className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20"
              >
                View Full Pricing Details
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Fitness Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who have already transformed their lives
            with GymCoach AI.
          </p>

          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button
                variant="primary"
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4"
              >
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button
                  variant="primary"
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4"
                >
                  Start Your Free Trial
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-4"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center mb-4">
                <Dumbbell className="h-8 w-8 text-blue-400 mr-3" />
                <span className="text-2xl font-bold">GymCoach AI</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Your intelligent fitness companion powered by AI. Transform your
                fitness journey with personalized workouts, nutrition tracking,
                and real-time coaching.
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-gray-400" />
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Smart Workouts</li>
                <li>Nutrition Tracking</li>
                <li>Sleep Monitoring</li>
                <li>AI Coaching</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Web Application</li>
                <li>iOS App</li>
                <li>Android App</li>
                <li>API Access</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 mt-8 text-center text-gray-400">
            <p>
              &copy; 2025 GymCoach AI. Built with Next.js, React Native, and AWS
              Lambda.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
