'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  useCurrentUser,
  AuthGuard,
  signOut as amplifySignOut,
} from '@packages/auth';
import { useRouter, usePathname } from 'next/navigation';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import LocaleSync from '../../components/LocaleSync';
import { AINotificationHandler } from '../../components/ai/AINotificationHandler';
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  Apple,
  User,
  LogOut,
  Menu,
  X,
  Settings,
  Calendar,
  TrendingUp,
  Clock,
  Target,
  ChevronDown,
  ChevronRight,
  Play,
  BookOpen,
  Bot,
} from 'lucide-react';

export default function ClientLayout({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [localeChangeKey, setLocaleChangeKey] = useState(0);

  // Sync locale to localStorage and cookie on mount and when locale changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', locale);
      document.cookie = `preferredLocale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [locale]);

  // Listen for locale changes and force re-render
  useEffect(() => {
    const handleLocaleChange = () => {
      setLocaleChangeKey((prev) => prev + 1);
    };

    window.addEventListener('localeChanged', handleLocaleChange);
    return () =>
      window.removeEventListener('localeChanged', handleLocaleChange);
  }, []);

  // Persist sidebar states
  useEffect(() => {
    try {
      const collapsed = localStorage.getItem('gc_desktop_sidebar_collapsed');
      if (collapsed === 'true') setDesktopSidebarCollapsed(true);

      const mobileOpen = localStorage.getItem('gc_sidebar_open');
      if (mobileOpen === 'true') setSidebarOpen(true);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'gc_desktop_sidebar_collapsed',
        desktopSidebarCollapsed ? 'true' : 'false'
      );
    } catch (e) {
      // ignore
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('gc_sidebar_open', sidebarOpen ? 'true' : 'false');
    } catch (e) {
      // ignore
    }
  }, [sidebarOpen]);

  const navigation = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    {
      name: t('workouts'),
      href: '/workouts',
      icon: Dumbbell,
      children: [
        { name: t('workout_sessions'), href: '/workouts/sessions', icon: Play },
        { name: t('workout_plans'), href: '/workouts/plans', icon: Calendar },
        {
          name: t('exercise_library'),
          href: '/workouts/exercises',
          icon: BookOpen,
        },
        {
          name: t('workout_analytics'),
          href: '/workouts/analytics',
          icon: TrendingUp,
        },
        { name: t('workout_history'), href: '/workouts/history', icon: Clock },
        {
          name: t('progress_photos'),
          href: '/workouts/progress-photos',
          icon: Target,
        },
      ],
    },
    { name: t('ai_trainer'), href: '/ai-trainer', icon: Bot },
    { name: t('analytics'), href: '/analytics', icon: BarChart3 },
    { name: t('nutrition'), href: '/nutrition', icon: Apple },
    { name: t('profile'), href: '/profile', icon: User },
  ];

  const handleSignOut = async () => {
    try {
      await amplifySignOut();
      // Clear the access_token cookie
      document.cookie =
        'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push(`/${locale}/auth/signin`);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Check if current path is an auth page or public page (should not have auth guard)
  const isAuthPage = pathname.includes('/auth/');
  const isPublicPage =
    pathname === '/' ||
    pathname.includes('/pricing') ||
    pathname.includes('/terms') ||
    pathname.includes('/privacy');

  // If it's an auth or public page, don't wrap in AuthGuard
  if (isAuthPage || isPublicPage) {
    return (
      <>
        <LocaleSync />
        {children}
      </>
    );
  }

  return (
    <AuthGuard>
      <LocaleSync />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        >
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent
              navigation={navigation}
              pathname={pathname}
              user={user}
              onSignOut={handleSignOut}
              locale={locale}
              tAuth={tAuth}
            />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div
          className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${desktopSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
        >
          <SidebarContent
            navigation={navigation}
            pathname={pathname}
            user={user}
            onSignOut={handleSignOut}
            collapsed={desktopSidebarCollapsed}
            onToggleCollapse={() =>
              setDesktopSidebarCollapsed(!desktopSidebarCollapsed)
            }
            locale={locale}
            tAuth={tAuth}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar for mobile */}
          <div className="sticky top-0 z-10 lg:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* Page header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {navigation.find((item) => {
                      const localizedHref = `/${locale}${item.href}`;
                      if (pathname === localizedHref) return true;
                      return item.children?.some(
                        (child) => pathname === `/${locale}${child.href}`
                      );
                    })?.name || 'Dashboard'}
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <LanguageSwitcher />
                  <ThemeToggle />
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {user?.name}
                    </div>
                    <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto" key={localeChangeKey}>
            <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
          </main>
        </div>

        {/* AI Notification Handler */}
        <AINotificationHandler />
      </div>
    </AuthGuard>
  );
}

function SidebarContent({
  navigation,
  pathname,
  user,
  onSignOut,
  collapsed = false,
  onToggleCollapse,
  locale,
  tAuth,
}: {
  navigation: Array<{
    name: string;
    href: string;
    icon: any;
    children?: Array<{ name: string; href: string; icon: any }>;
  }>;
  pathname: string;
  user: any;
  onSignOut: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  locale: string;
  tAuth: any;
}) {
  const [expandedItems, setExpandedItems] = useState<{
    [key: string]: boolean;
  }>({});

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  // Helper to ensure href includes locale prefix
  const getLocalizedHref = (href: string) => {
    if (!locale) return href;
    // If href already starts with locale, return as-is
    if (href.startsWith(`/${locale}/`)) return href;
    // Otherwise prepend locale
    return `/${locale}${href}`;
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div
          className={`flex items-center flex-shrink-0 px-4 ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            {!collapsed && (
              <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
                GymCoach
              </span>
            )}
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${collapsed ? 'mx-auto' : ''}`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const localizedHref = getLocalizedHref(item.href);
            const isActive = pathname === localizedHref;
            const isParentActive = item.children?.some(
              (child) => pathname === getLocalizedHref(child.href)
            );
            const shouldExpand = expandedItems[item.name] || isParentActive;

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => !collapsed && toggleExpanded(item.name)}
                      className={`w-full group flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-2'} py-2 text-sm font-medium rounded-md ${
                        isActive || isParentActive
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={`${collapsed ? 'h-5 w-5' : 'mr-3 flex-shrink-0 h-5 w-5'} ${
                            isActive || isParentActive
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                          }`}
                        />
                        {!collapsed && item.name}
                      </div>
                      {!collapsed &&
                        (shouldExpand ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                    </button>
                    {!collapsed && shouldExpand && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const childLocalizedHref = getLocalizedHref(
                            child.href
                          );
                          // Check if pathname matches or starts with the child href (for nested pages)
                          const isChildActive = 
                            pathname === childLocalizedHref || 
                            pathname === `${childLocalizedHref}/` ||
                            pathname.startsWith(`${childLocalizedHref}/`);
                          return (
                            <a
                              key={child.name}
                              href={childLocalizedHref}
                              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                isChildActive
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                              }`}
                            >
                              <child.icon
                                className={`mr-3 flex-shrink-0 h-4 w-4 ${
                                  isChildActive
                                    ? 'text-blue-500 dark:text-blue-400'
                                    : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                                }`}
                              />
                              {child.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <a
                    href={localizedHref}
                    className={`group flex items-center ${collapsed ? 'justify-center px-2' : 'px-2'} py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={`${collapsed ? 'h-5 w-5' : 'mr-3 flex-shrink-0 h-5 w-5'} ${
                        isActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }`}
                    />
                    {!collapsed && item.name}
                  </a>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-shrink-0 w-full group block">
          {!collapsed ? (
            <>
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user?.name}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="mt-2 w-full flex items-center px-2 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-md"
              >
                <LogOut className="mr-3 flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" />
                {tAuth('sign_out')}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <button
                onClick={onSignOut}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-md"
                title={tAuth('sign_out')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isManualTheme, setIsManualTheme] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
    // Check if theme is manually set
    setIsManualTheme(localStorage.getItem('gymcoach-theme-manual') === 'true');
  }, []);

  const handleThemeToggle = () => {
    // When user manually toggles, set explicit theme (not system)
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    // Also set a flag to indicate manual override
    localStorage.setItem('gymcoach-theme-manual', 'true');
    setIsManualTheme(true);

    console.log('Theme manually toggled to:', newTheme);
  };

  const handleUseSystem = () => {
    // Remove manual flag and set theme to system
    localStorage.removeItem('gymcoach-theme-manual');
    setTheme('system');
    setIsManualTheme(false);
    console.log('Theme set to follow system preference');
  };

  if (!mounted) {
    return (
      <div className="flex space-x-2">
        <button
          className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          disabled
        >
          Loading...
        </button>
      </div>
    );
  }

  return (
    <div className="flex space-x-2">
      <button
        className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        onClick={handleThemeToggle}
      >
        {resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode
      </button>
      {isManualTheme && (
        <button
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          onClick={handleUseSystem}
          title="Follow system theme preference"
        >
          Auto
        </button>
      )}
    </div>
  );
}
