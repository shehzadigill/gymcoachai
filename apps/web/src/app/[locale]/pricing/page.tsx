'use client';

import { Button, Card, Badge } from 'ui';
import { useCurrentUser } from '@packages/auth';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Dumbbell,
  ArrowLeft,
  Check,
  X,
  Star,
  Zap,
  Crown,
  Brain,
  Apple,
  BarChart3,
  Heart,
  Clock,
  Users,
  Shield,
  Smartphone,
  Target,
  TrendingUp,
  Camera,
  MessageCircle,
  Bell,
  Download,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

export default function PricingPage() {
  const { isAuthenticated } = useCurrentUser();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    'monthly'
  );

  const plans = {
    free: {
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      description: 'Perfect for getting started with basic fitness tracking',
      features: [
        'Basic workout logging',
        'Simple nutrition tracking',
        'Basic sleep monitoring',
        'Weekly progress reports',
        'Access to exercise library',
        'Community support forum',
      ],
      limitations: [
        'Limited to 3 custom workouts',
        'Basic AI recommendations only',
        'No real-time form analysis',
        'Standard support',
      ],
      buttonText: 'Start Free',
      popular: false,
      color: 'gray',
    },
    premium: {
      name: 'Premium',
      price: { monthly: 19.99, yearly: 199.99 },
      description:
        'Complete AI-powered fitness transformation with advanced features',
      features: [
        'Unlimited AI-generated workouts',
        'Advanced nutrition planning with meal suggestions',
        'Comprehensive sleep analysis with optimization tips',
        'Real-time form analysis with camera',
        'Personalized AI coaching and motivation',
        'Advanced progress analytics and insights',
        'Custom goal setting and tracking',
        'Priority support',
        'Offline mobile app access',
        'Export data and reports',
        'Integration with fitness trackers',
        'Exclusive workout programs',
      ],
      limitations: [],
      buttonText: 'Start 7-Day Free Trial',
      popular: true,
      color: 'blue',
    },
    enterprise: {
      name: 'Enterprise',
      price: { monthly: 'Custom', yearly: 'Custom' },
      description: 'For gyms, trainers, and fitness organizations',
      features: [
        'Everything in Premium',
        'White-label mobile apps',
        'Multi-tenant dashboard',
        'Custom branding',
        'API access',
        'Advanced analytics dashboard',
        'Bulk user management',
        'Custom integrations',
        'Dedicated account manager',
        '24/7 priority support',
        'Custom training programs',
        'HIPAA compliance options',
      ],
      limitations: [],
      buttonText: 'Contact Sales',
      popular: false,
      color: 'purple',
    },
  };

  const yearlyDiscount = (monthly: number) => {
    const yearly = monthly * 12 * 0.83; // 17% discount
    return yearly;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
              <span className="text-2xl font-bold text-gray-900">
                GymCoach AI
              </span>
            </Link>
            <div className="flex gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="primary" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
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

      {/* Header */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>

          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
              <Crown className="h-4 w-4" />
              Choose Your Fitness Journey
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Simple, Transparent
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {' '}
              Pricing{' '}
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Start free and upgrade when you're ready for advanced AI features.
            No hidden fees, cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-16">
            <div className="bg-white rounded-full p-1 shadow-lg border">
              <div className="flex items-center">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    billingCycle === 'yearly'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Yearly
                  <Badge variant="success" className="ml-2 text-xs">
                    Save 17%
                  </Badge>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="relative p-8 border-2 border-gray-200 hover:border-gray-300 transition-all">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plans.free.name}
                </h3>
                <p className="text-gray-600 mb-6">{plans.free.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
                {isAuthenticated ? (
                  <Button variant="outline" size="lg" className="w-full">
                    Current Plan
                  </Button>
                ) : (
                  <Link href="/auth/signup">
                    <Button variant="outline" size="lg" className="w-full">
                      {plans.free.buttonText}
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  What's included:
                </h4>
                <ul className="space-y-3">
                  {plans.free.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <h4 className="font-semibold text-gray-900 flex items-center pt-4">
                  <X className="h-5 w-5 text-gray-400 mr-2" />
                  Limitations:
                </h4>
                <ul className="space-y-3">
                  {plans.free.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start">
                      <X className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-500">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Premium Plan */}
            <Card className="relative p-8 border-2 border-blue-500 shadow-xl scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge
                  variant="info"
                  className="px-4 py-1 bg-blue-600 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Most Popular
                </Badge>
              </div>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plans.premium.name}
                </h3>
                <p className="text-gray-600 mb-6">
                  {plans.premium.description}
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    ${billingCycle === 'monthly' ? '19.99' : '16.66'}
                  </span>
                  <span className="text-gray-600">
                    /{billingCycle === 'monthly' ? 'month' : 'month'}
                  </span>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium">
                      Billed yearly at $199.99
                    </div>
                  )}
                </div>
                {isAuthenticated ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    Upgrade Now
                  </Button>
                ) : (
                  <Link href="/auth/signup">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {plans.premium.buttonText}
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Everything in Premium:
                </h4>
                <ul className="space-y-3">
                  {plans.premium.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative p-8 border-2 border-purple-200 hover:border-purple-300 transition-all">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plans.enterprise.name}
                </h3>
                <p className="text-gray-600 mb-6">
                  {plans.enterprise.description}
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    Custom
                  </span>
                  <span className="text-gray-600">/pricing</span>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  {plans.enterprise.buttonText}
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Enterprise features:
                </h4>
                <ul className="space-y-3">
                  {plans.enterprise.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Compare All Features
            </h2>
            <p className="text-xl text-gray-600">
              See exactly what you get with each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">
                    Features
                  </th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">
                    Free
                  </th>
                  <th className="text-center py-4 px-6 font-semibold text-blue-600">
                    Premium
                  </th>
                  <th className="text-center py-4 px-6 font-semibold text-purple-600">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  {
                    category: 'Workouts',
                    features: [
                      {
                        name: 'Basic workout logging',
                        free: true,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'AI-generated workouts',
                        free: '3/month',
                        premium: 'Unlimited',
                        enterprise: 'Unlimited',
                      },
                      {
                        name: 'Custom workout builder',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Real-time form analysis',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Exercise video library',
                        free: 'Basic',
                        premium: 'Premium',
                        enterprise: 'Custom',
                      },
                    ],
                  },
                  {
                    category: 'Nutrition',
                    features: [
                      {
                        name: 'Food logging',
                        free: true,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Calorie tracking',
                        free: true,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'AI meal suggestions',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Macro optimization',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Custom meal plans',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                    ],
                  },
                  {
                    category: 'Analytics',
                    features: [
                      {
                        name: 'Basic progress tracking',
                        free: true,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Advanced analytics',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Custom reports',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Data export',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'API access',
                        free: false,
                        premium: false,
                        enterprise: true,
                      },
                    ],
                  },
                  {
                    category: 'Support',
                    features: [
                      {
                        name: 'Community support',
                        free: true,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Email support',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Priority support',
                        free: false,
                        premium: true,
                        enterprise: true,
                      },
                      {
                        name: 'Dedicated account manager',
                        free: false,
                        premium: false,
                        enterprise: true,
                      },
                      {
                        name: '24/7 phone support',
                        free: false,
                        premium: false,
                        enterprise: true,
                      },
                    ],
                  },
                ].map((category, categoryIndex) =>
                  category.features.map((feature, featureIndex) => (
                    <tr
                      key={`${categoryIndex}-${featureIndex}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="py-4 px-6">
                        {featureIndex === 0 && (
                          <div className="font-semibold text-gray-900 mb-1">
                            {category.category}
                          </div>
                        )}
                        <div className={featureIndex === 0 ? '' : 'ml-4'}>
                          {feature.name}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {typeof feature.free === 'boolean' ? (
                          feature.free ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700">{feature.free}</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {typeof feature.premium === 'boolean' ? (
                          feature.premium ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="text-blue-700 font-medium">
                            {feature.premium}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {typeof feature.enterprise === 'boolean' ? (
                          feature.enterprise ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="text-purple-700 font-medium">
                            {feature.enterprise}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                question: 'Can I switch between plans?',
                answer:
                  "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any charges.",
              },
              {
                question: 'What happens after my free trial ends?',
                answer:
                  "After your 7-day free trial, you'll be automatically charged for the Premium plan. You can cancel anytime during the trial with no charges.",
              },
              {
                question: 'Is there a long-term commitment?',
                answer:
                  'No, all plans are month-to-month or yearly with no long-term contracts. You can cancel anytime.',
              },
              {
                question: 'Do you offer refunds?',
                answer:
                  "We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, we'll refund your payment.",
              },
              {
                question: 'Can I use GymCoach AI offline?',
                answer:
                  'Premium users get offline access to workouts and previously synced data in our mobile app. Some features require internet connectivity.',
              },
              {
                question: 'How does the AI coaching work?',
                answer:
                  'Our AI analyzes your workout data, form, and progress to provide personalized recommendations, corrections, and motivation in real-time.',
              },
            ].map((faq, index) => (
              <Card key={index} className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Your Fitness Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who have transformed their lives with
            AI-powered fitness coaching.
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
                  Start 7-Day Free Trial
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

          <p className="text-blue-100 text-sm mt-4">
            No credit card required • Cancel anytime • 30-day money-back
            guarantee
          </p>
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
            </div>

            <div>
              <h4 className="font-semibold mb-4">Plans</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Free Plan</li>
                <li>Premium Plan</li>
                <li>Enterprise Plan</li>
                <li>Compare Plans</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Help Center</li>
                <li>Contact Support</li>
                <li>System Status</li>
                <li>Feature Requests</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 mt-8 text-center text-gray-400">
            <p>&copy; 2025 GymCoach AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
