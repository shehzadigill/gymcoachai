'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SleepLogger, SleepDashboard } from '../../../components/sleep';
import { Moon, BarChart3, Calendar, TrendingUp } from 'lucide-react';

export default function SleepPage() {
  const t = useTranslations('sleep_page');
  const [activeTab, setActiveTab] = useState<'logger' | 'dashboard'>('logger');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const tabs = [
    {
      id: 'logger' as const,
      name: t('log_sleep'),
      icon: <Moon className="h-5 w-5" />,
      description: t('sleep_today'),
    },
    {
      id: 'dashboard' as const,
      name: t('sleep_insights'),
      icon: <BarChart3 className="h-5 w-5" />,
      description: t('sleep_trends'),
    },
  ];

  const handleSleepLogged = (data: any) => {
    // Optionally refresh dashboard data or show success message
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'logger' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Daily Sleep Logger
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Log your sleep hours, quality, and patterns
                    </p>
                  </div>
                </div>
              </div>

              <SleepLogger
                selectedDate={selectedDate}
                onSleepLogged={handleSleepLogged}
                showHistory={true}
              />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Sleep Analytics
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Analyze your sleep patterns and trends
                    </p>
                  </div>
                </div>
              </div>

              <SleepDashboard period="month" showGoals={true} />
            </div>
          )}
        </div>

        {/* Mobile FAB for quick logging */}
        <div className="fixed bottom-6 right-6 sm:hidden">
          <button
            onClick={() => setActiveTab('logger')}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-colors"
          >
            <Moon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
