'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  useCurrentUser,
  AuthGuard,
  signOut as amplifySignOut,
} from '@packages/auth';
import { useRouter, usePathname } from 'next/navigation';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Workouts',
      href: '/workouts',
      icon: Dumbbell,
      children: [
        { name: 'Workout Sessions', href: '/workouts/sessions', icon: Play },
        { name: 'Workout Plans', href: '/workouts/plans', icon: Calendar },
        {
          name: 'Exercise Library',
          href: '/workouts/exercises',
          icon: BookOpen,
        },
        { name: 'Analytics', href: '/workouts/analytics', icon: TrendingUp },
        { name: 'History', href: '/workouts/history', icon: Clock },
        {
          name: 'Progress Photos',
          href: '/workouts/progress-photos',
          icon: Target,
        },
      ],
    },
    { name: 'AI Trainer', href: '/ai-trainer', icon: Bot },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Nutrition', href: '/nutrition', icon: Apple },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const handleSignOut = async () => {
    try {
      await amplifySignOut();
      // Clear the access_token cookie
      document.cookie =
        'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push('/auth/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthGuard>
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
            />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0 lg:w-64">
          <SidebarContent
            navigation={navigation}
            pathname={pathname}
            user={user}
            onSignOut={handleSignOut}
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
                    {navigation.find((item) => item.href === pathname)?.name ||
                      'Dashboard'}
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
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
          <main className="flex-1 overflow-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

function SidebarContent({
  navigation,
  pathname,
  user,
  onSignOut,
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

  return (
    <div className="flex flex-col h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
              GymCoach
            </span>
          </div>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const isParentActive = item.children?.some(
              (child) => pathname === child.href
            );
            const shouldExpand = expandedItems[item.name] || isParentActive;

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md ${
                        isActive || isParentActive
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={`mr-3 flex-shrink-0 h-5 w-5 ${
                            isActive || isParentActive
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                          }`}
                        />
                        {item.name}
                      </div>
                      {shouldExpand ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {shouldExpand && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <a
                              key={child.name}
                              href={child.href}
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
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${
                        isActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }`}
                    />
                    {item.name}
                  </a>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-shrink-0 w-full group block">
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
            Sign out
          </button>
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
