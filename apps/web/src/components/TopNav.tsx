'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  Apple,
  Bot,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
} from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import AvatarDropdown from './AvatarDropdown';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  children?: Array<{ name: string; href: string; icon: any }>;
}

interface TopNavProps {
  user: any;
  onSignOut: () => void;
  locale: string;
}

export default function TopNav({ user, onSignOut, locale }: TopNavProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [workoutsOpen, setWorkoutsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const workoutsRef = useRef<HTMLDivElement>(null);

  const navigation: NavigationItem[] = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    {
      name: t('workouts'),
      href: '/workouts',
      icon: Dumbbell,
      children: [
        {
          name: t('workout_sessions'),
          href: '/workouts/sessions',
          icon: LayoutDashboard,
        },
        {
          name: t('workout_plans'),
          href: '/workouts/plans',
          icon: LayoutDashboard,
        },
        {
          name: t('exercise_library'),
          href: '/workouts/exercises',
          icon: LayoutDashboard,
        },
        {
          name: t('workout_analytics'),
          href: '/workouts/analytics',
          icon: LayoutDashboard,
        },
        {
          name: t('workout_history'),
          href: '/workouts/history',
          icon: LayoutDashboard,
        },
        {
          name: t('progress_photos'),
          href: '/workouts/progress-photos',
          icon: LayoutDashboard,
        },
      ],
    },
    { name: t('ai_trainer'), href: '/ai-trainer', icon: Bot },
    { name: t('analytics'), href: '/analytics', icon: BarChart3 },
    { name: t('nutrition'), href: '/nutrition', icon: Apple },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        workoutsRef.current &&
        !workoutsRef.current.contains(event.target as Node)
      ) {
        setWorkoutsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (item: NavigationItem) => {
    const localizedHref = `/${locale}${item.href}`;
    if (pathname === localizedHref) return true;
    if (item.children) {
      return item.children.some(
        (child) =>
          pathname === `/${locale}${child.href}` ||
          pathname.startsWith(`/${locale}${child.href}/`)
      );
    }
    return false;
  };

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3 sm:py-4">
          {/* Left side - Logo and Hamburger */}
          <div className="flex items-center space-x-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Dumbbell className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              <span className="ml-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                GymCoach
              </span>
            </div>

            {/* Main Navigation */}
            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {navigation.map((item) => {
                const active = isActive(item);
                const localizedHref = `/${locale}${item.href}`;

                if (item.children) {
                  return (
                    <div key={item.name} className="relative" ref={workoutsRef}>
                      <button
                        onClick={() => setWorkoutsOpen(!workoutsOpen)}
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          active
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                            : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <item.icon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        {item.name}
                        <ChevronDown
                          className={`ml-1.5 h-4 w-4 transition-transform flex-shrink-0 ${workoutsOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {workoutsOpen && (
                        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1">
                            {item.children.map((child) => {
                              const childHref = `/${locale}${child.href}`;
                              const childActive =
                                pathname === childHref ||
                                pathname.startsWith(`${childHref}/`);

                              return (
                                <a
                                  key={child.name}
                                  href={childHref}
                                  className={`block px-4 py-2 text-sm ${
                                    childActive
                                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                  onClick={() => setWorkoutsOpen(false)}
                                >
                                  {child.name}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <a
                    key={item.name}
                    href={localizedHref}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    {item.name}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Right side - Language, Theme, Avatar */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>
            <ThemeToggle />
            <AvatarDropdown user={user} onSignOut={onSignOut} locale={locale} />
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 py-3 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item);
              const localizedHref = `/${locale}${item.href}`;

              if (item.children) {
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => setWorkoutsOpen(!workoutsOpen)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md ${
                        active
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${workoutsOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {workoutsOpen && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const childHref = `/${locale}${child.href}`;
                          const childActive =
                            pathname === childHref ||
                            pathname.startsWith(`${childHref}/`);

                          return (
                            <a
                              key={child.name}
                              href={childHref}
                              className={`block px-3 py-2 text-sm rounded-md ${
                                childActive
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {child.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <a
                  key={item.name}
                  href={localizedHref}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md ${
                    active
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </a>
              );
            })}

            {/* Mobile Language Switcher */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
              <div className="px-3">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-md bg-gray-100 dark:bg-gray-700 animate-pulse" />
    );
  }

  const currentTheme = theme === 'system' ? 'auto' : theme;
  const Icon =
    currentTheme === 'dark' ? Moon : currentTheme === 'light' ? Sun : Monitor;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        title={`Theme: ${currentTheme}`}
      >
        <Icon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <button
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-4 py-2 text-sm ${
                theme === 'light'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </button>
            <button
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-4 py-2 text-sm ${
                theme === 'dark'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </button>
            <button
              onClick={() => {
                setTheme('system');
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-4 py-2 text-sm ${
                theme === 'system'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Monitor className="h-4 w-4 mr-2" />
              Auto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
