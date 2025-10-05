'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Dumbbell,
  Shield,
  Lock,
  Eye,
  Database,
  Server,
  Globe,
  Users,
  FileText,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function PrivacyPage() {
  const dataTypes = [
    {
      title: 'Personal Information',
      icon: Users,
      items: [
        'Name and email address',
        'Username and password',
        'Profile picture (optional)',
        'Contact preferences',
      ],
      color: 'blue',
    },
    {
      title: 'Fitness & Health Data',
      icon: Database,
      items: [
        'Workout history and performance',
        'Nutrition logs and meal data',
        'Sleep patterns and quality',
        'Body measurements and progress',
      ],
      color: 'green',
    },
    {
      title: 'Usage Information',
      icon: Eye,
      items: [
        'App usage patterns',
        'Feature interactions',
        'Device information',
        'IP address and location',
      ],
      color: 'purple',
    },
    {
      title: 'Technical Data',
      icon: Server,
      items: [
        'Log files and analytics',
        'Crash reports',
        'Performance metrics',
        'Security incident data',
      ],
      color: 'orange',
    },
  ];

  const securityMeasures = [
    {
      title: 'End-to-End Encryption',
      description:
        'All data encrypted in transit and at rest using industry-standard AES-256',
    },
    {
      title: 'AWS Security',
      description:
        'Hosted on Amazon Web Services with enterprise-grade security infrastructure',
    },
    {
      title: 'Access Controls',
      description:
        'Limited employee access on a need-to-know basis with multi-factor authentication',
    },
    {
      title: 'Regular Audits',
      description: 'Quarterly security assessments and penetration testing',
    },
    {
      title: 'Data Minimization',
      description:
        'We only collect and store data necessary for service functionality',
    },
    {
      title: 'Secure Backups',
      description:
        'Encrypted backups with geographic redundancy for data protection',
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
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
              <div className="flex items-center text-blue-100">
                <Clock className="h-4 w-4 mr-2" />
                <span>Last updated: October 5, 2025</span>
              </div>
            </div>
          </div>

          <p className="text-xl text-blue-100 max-w-3xl">
            Your privacy and data security are fundamental to everything we do.
            This policy explains how we collect, use, and protect your
            information when you use GymCoach AI.
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Privacy Promise */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center mb-4">
            <Lock className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              Our Privacy Promise
            </h2>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            We're committed to protecting your personal information and being
            transparent about how we collect, use, and share your data. Your
            fitness journey is personal, and we treat your data with the respect
            and security it deserves.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-semibold text-green-900">
                We Never Sell Your Data
              </h4>
              <p className="text-green-700 text-sm">
                Your information is never sold to third parties.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 mb-2" />
              <h4 className="font-semibold text-blue-900">
                Enterprise Security
              </h4>
              <p className="text-blue-700 text-sm">
                Bank-level encryption and security measures.
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <Users className="h-6 w-6 text-purple-600 mb-2" />
              <h4 className="font-semibold text-purple-900">
                You're In Control
              </h4>
              <p className="text-purple-700 text-sm">
                Full control over your data and privacy settings.
              </p>
            </div>
          </div>
        </div>

        {/* Information We Collect */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Information We Collect
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dataTypes.map((dataType, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className={`bg-${dataType.color}-100 p-3 rounded-lg w-fit mb-4`}
                >
                  <dataType.icon
                    className={`h-6 w-6 text-${dataType.color}-600`}
                  />
                </div>
                <h3 className="font-bold text-gray-900 mb-3">
                  {dataType.title}
                </h3>
                <ul className="space-y-2">
                  {dataType.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="text-sm text-gray-600 flex items-start"
                    >
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* How We Use Your Information */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            How We Use Your Information
          </h2>
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
            <p className="text-gray-800 text-lg">
              <strong>Primary Purpose:</strong> We use your data to provide
              personalized fitness coaching, create custom workout plans, track
              your progress, and improve our AI recommendations to help you
              achieve your fitness goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Core Features</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Generate personalized workout and nutrition plans
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Track your fitness progress and provide insights
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Analyze sleep patterns and recovery metrics
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Provide real-time form analysis and corrections
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-4">
                Service Improvements
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Improve our AI algorithms and recommendations
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Send relevant notifications and reminders
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Provide customer support and assistance
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Communicate important service updates
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Data Security */}
        <div className="bg-gray-900 text-white rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Shield className="h-8 w-8 mr-3" />
            How We Protect Your Data
          </h2>
          <p className="text-gray-300 mb-8">
            We implement multiple layers of security to protect your personal
            information using industry-leading standards and practices.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityMeasures.map((measure, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6">
                <h3 className="font-bold mb-3">{measure.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {measure.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Data Sharing */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Data Sharing Policy
          </h2>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-3">
              <Shield className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="font-bold text-red-900">
                We Never Sell Your Data
              </h3>
            </div>
            <p className="text-red-800">
              Your personal information is never sold to advertisers, marketers,
              or any third parties. We only share your information in the
              limited circumstances described below.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-green-600">
                ✓ When We May Share
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    With your explicit consent for specific features
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    To comply with legal obligations and court orders
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    With trusted service providers under strict agreements
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    In aggregated, anonymized form for research
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-red-600">
                ✗ We Never Share
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    Personal data with advertisers or marketers
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    Individual health data without consent
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    Data for commercial purposes outside our service
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 mt-2"></div>
                  <span className="text-gray-700">
                    Login credentials or account access
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Your Rights */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Your Privacy Rights
          </h2>
          <p className="text-gray-600 mb-6">
            You have full control over your personal data. Here's what you can
            do:
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <Eye className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Access Your Data</h3>
              <p className="text-gray-600 text-sm">
                View and download all personal information we have about you.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <FileText className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">
                Correct Information
              </h3>
              <p className="text-gray-600 text-sm">
                Update or correct any inaccurate personal information.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <Database className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Export Data</h3>
              <p className="text-gray-600 text-sm">
                Download your data in a portable format to use elsewhere.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <Lock className="h-8 w-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Delete Account</h3>
              <p className="text-gray-600 text-sm">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <Globe className="h-8 w-8 text-teal-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">
                Control Communications
              </h3>
              <p className="text-gray-600 text-sm">
                Opt out of marketing emails and adjust notification settings.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <Shield className="h-8 w-8 text-red-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">
                Object to Processing
              </h3>
              <p className="text-gray-600 text-sm">
                Object to certain uses of your data for legitimate reasons.
              </p>
            </div>
          </div>
        </div>

        {/* Health Information Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">
            Health Information Notice
          </h2>
          <div className="space-y-4 text-amber-800">
            <p>
              <strong>Not a Medical Device:</strong> GymCoach AI is not a
              medical device or healthcare provider. We collect fitness and
              wellness data to provide coaching, not medical diagnoses.
            </p>
            <p>
              <strong>Consult Healthcare Professionals:</strong> Always consult
              with qualified healthcare professionals for medical advice,
              diagnoses, or treatment decisions.
            </p>
            <p>
              <strong>Emergency Situations:</strong> Never rely on our service
              for emergency medical situations. Seek immediate medical attention
              when needed.
            </p>
            <p>
              <strong>Data Protection:</strong> Health-related data is subject
              to additional security measures and is never used for insurance or
              employment purposes.
            </p>
          </div>
        </div>

        {/* Additional Policies */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Children's Privacy
            </h3>
            <p className="text-gray-600 mb-4">
              Our service is designed for users 13 years and older. We do not
              knowingly collect personal information from children under 13.
            </p>
            <p className="text-gray-600">
              If we discover that we have collected information from a child
              under 13, we will delete it immediately. Parents who believe we
              may have collected such information should contact us.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              International Users
            </h3>
            <p className="text-gray-600 mb-4">
              GymCoach AI operates globally with servers located in the United
              States and other regions for optimal performance.
            </p>
            <p className="text-gray-600">
              We comply with applicable data protection laws including GDPR for
              European users and provide appropriate safeguards for
              international data transfers.
            </p>
          </div>
        </div>

        {/* Updates to Policy */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Policy Updates
          </h2>
          <p className="text-gray-600 mb-4">
            We may update this Privacy Policy periodically to reflect changes in
            our practices, technology, or legal requirements.
          </p>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-blue-800">
              <strong>We'll notify you of material changes via:</strong> Email
              notification, in-app notification, or prominent notice on our
              website. Continued use after notification constitutes acceptance
              of the updated policy.
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">
            Questions About Your Privacy?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            We're committed to transparency and here to help with any privacy
            concerns or questions.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/20 rounded-lg p-6">
              <h3 className="font-bold mb-3">General Privacy Questions</h3>
              <a
                href="mailto:privacy@gymcoach-ai.com"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-block"
              >
                privacy@gymcoach-ai.com
              </a>
            </div>

            <div className="bg-white/20 rounded-lg p-6">
              <h3 className="font-bold mb-3">Data Protection Officer</h3>
              <a
                href="mailto:dpo@gymcoach-ai.com"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-block"
              >
                dpo@gymcoach-ai.com
              </a>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/support"
              className="border border-white text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-blue-600 transition-colors inline-block"
            >
              Contact Support Team
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
