'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Dumbbell,
  Scale,
  Shield,
  AlertTriangle,
  Users,
  FileText,
  Clock,
} from 'lucide-react';

export default function TermsPage() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const sections = [
    {
      title: '1. Acceptance of Terms',
      icon: FileText,
      content:
        'By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.',
    },
    {
      title: '2. Description of Service',
      icon: Dumbbell,
      content:
        'GymCoach AI provides AI-powered fitness coaching, including personalized workout plans, nutrition tracking, sleep monitoring, progress analytics, and real-time AI coaching.',
    },
    {
      title: '3. User Accounts',
      icon: Users,
      content:
        'You must create an account to use certain features. You are responsible for maintaining the confidentiality of your account and password.',
    },
    {
      title: '4. Health and Safety',
      icon: AlertTriangle,
      content:
        'GymCoach AI is not a substitute for professional medical advice. Always consult with healthcare professionals before starting any fitness program.',
    },
    {
      title: '5. Privacy',
      icon: Shield,
      content:
        'Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service.',
    },
    {
      title: '6. Subscription and Billing',
      icon: Scale,
      content:
        'Premium features require a paid subscription. You will be charged according to your selected plan until you cancel.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center text-blue-100 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>

          <div className="flex items-center mb-6">
            <div className="bg-white/20 p-3 rounded-lg mr-4">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
              <div className="flex items-center text-blue-100">
                <Clock className="h-4 w-4 mr-2" />
                <span>Last updated: October 5, 2025</span>
              </div>
            </div>
          </div>

          <p className="text-xl text-blue-100 max-w-3xl">
            These terms govern your use of GymCoach AI. Please read them
            carefully as they contain important information about your rights
            and obligations.
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to GymCoach AI
          </h2>
          <p className="text-gray-600 leading-relaxed">
            These Terms of Service ("Terms") govern your use of the GymCoach AI
            platform, including our web application and mobile apps (the
            "Service"). By using our service, you agree to these terms and our
            commitment to helping you achieve your fitness goals safely and
            effectively.
          </p>
        </div>

        {/* Key Sections Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {sections.map((section, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <section.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Detailed Terms */}
        <div className="space-y-8">
          {/* Service Description */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Dumbbell className="h-6 w-6 text-blue-600 mr-3" />
              Our Services
            </h3>
            <p className="text-gray-600 mb-4">
              GymCoach AI provides comprehensive AI-powered fitness coaching
              through:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <ul className="space-y-2">
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Personalized workout plans
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  AI-powered nutrition recommendations
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Sleep monitoring and analysis
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Real-time form analysis
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Progress analytics and insights
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Mobile and web applications
                </li>
              </ul>
            </div>
          </div>

          {/* Subscription Terms */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Scale className="h-6 w-6 text-blue-600 mr-3" />
              Subscription and Billing
            </h3>
            <div className="space-y-4 text-gray-600">
              <p>
                <strong>Free Plan:</strong> Access to basic features with usage
                limitations.
              </p>
              <p>
                <strong>Premium Plan:</strong> $19.99/month or $199.99/year with
                advanced AI features.
              </p>
              <p>
                <strong>Billing:</strong> Automatic renewal unless cancelled.
                You may cancel anytime through your account settings.
              </p>
              <p>
                <strong>Refunds:</strong> 30-day money-back guarantee for new
                subscribers.
              </p>
              <p>
                <strong>Free Trial:</strong> 7-day free trial for Premium
                features, no credit card required.
              </p>
            </div>
          </div>

          {/* Health Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
            <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 mr-3" />
              Important Health and Safety Information
            </h3>
            <div className="space-y-4 text-amber-800">
              <p>
                <strong>Not Medical Advice:</strong> GymCoach AI is not a
                substitute for professional medical advice, diagnosis, or
                treatment.
              </p>
              <p>
                <strong>Consult Professionals:</strong> Always consult with
                healthcare professionals before starting any fitness program.
              </p>
              <p>
                <strong>Use at Your Own Risk:</strong> Exercise and dietary
                changes carry inherent risks. Listen to your body and stop if
                you experience pain or discomfort.
              </p>
              <p>
                <strong>Emergency Situations:</strong> Seek immediate medical
                attention for any serious health concerns.
              </p>
            </div>
          </div>

          {/* User Responsibilities */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-6 w-6 text-blue-600 mr-3" />
              Your Responsibilities
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Account Security
                </h4>
                <ul className="space-y-1 text-gray-600 text-sm">
                  <li>• Keep your login credentials secure</li>
                  <li>• Don't share your account with others</li>
                  <li>• Notify us of any unauthorized access</li>
                  <li>• Use strong, unique passwords</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Acceptable Use
                </h4>
                <ul className="space-y-1 text-gray-600 text-sm">
                  <li>• Provide accurate information</li>
                  <li>• Use the service lawfully</li>
                  <li>• Respect other users</li>
                  <li>• Don't attempt to hack or abuse the system</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Prohibited Activities */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-8">
            <h3 className="text-xl font-bold text-red-900 mb-4">
              Prohibited Uses
            </h3>
            <p className="text-red-800 mb-4">You may not use our Service to:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <ul className="space-y-2 text-red-700">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Violate any laws or regulations
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Impersonate others or create fake accounts
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Send spam or promotional content
                </li>
              </ul>
              <ul className="space-y-2 text-red-700">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Attempt to hack or disrupt the service
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Share inappropriate or harmful content
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">×</span>
                  Reverse engineer or copy our technology
                </li>
              </ul>
            </div>
          </div>

          {/* Intellectual Property */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Intellectual Property
            </h3>
            <div className="space-y-4 text-gray-600">
              <p>
                The Service and its content, features, and functionality are
                owned by GymCoach AI and protected by copyright, trademark, and
                other intellectual property laws.
              </p>
              <p>
                <strong>Your Content:</strong> You retain ownership of content
                you provide, but grant us a license to use it to provide our
                services.
              </p>
              <p>
                <strong>Our Content:</strong> You may not copy, modify,
                distribute, or create derivative works from our content without
                permission.
              </p>
            </div>
          </div>

          {/* Termination */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Account Termination
            </h3>
            <div className="space-y-4 text-gray-600">
              <p>
                <strong>Your Right to Cancel:</strong> You may cancel your
                account at any time through your account settings.
              </p>
              <p>
                <strong>Our Right to Terminate:</strong> We may suspend or
                terminate accounts that violate these terms or for other
                legitimate reasons.
              </p>
              <p>
                <strong>Effect of Termination:</strong> Upon termination, your
                access to the service will end, but these terms will continue to
                apply.
              </p>
            </div>
          </div>

          {/* Limitation of Liability */}
          <div className="bg-gray-50 rounded-xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Limitation of Liability
            </h3>
            <p className="text-gray-600 leading-relaxed">
              GymCoach AI provides the service "as is" without warranties. We
              are not liable for indirect, incidental, special, or consequential
              damages. Our total liability is limited to the amount you paid for
              the service in the 12 months preceding the claim.
            </p>
          </div>

          {/* Changes to Terms */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Changes to These Terms
            </h3>
            <p className="text-gray-600 leading-relaxed">
              We may update these Terms from time to time. We'll notify you of
              material changes by email or through the service. Continued use of
              the service after changes constitutes acceptance of the new terms.
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center mt-12">
          <h3 className="text-2xl font-bold mb-4">
            Questions About These Terms?
          </h3>
          <p className="mb-6 text-blue-100">
            We're here to help. Contact our legal team if you have any questions
            about these terms or your rights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:legal@gymcoach-ai.com"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              legal@gymcoach-ai.com
            </a>
            <Link
              href="/support"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white hover:text-blue-600 transition-colors"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
