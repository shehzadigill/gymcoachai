'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { webNotificationService } from '@/lib/notifications';

interface NotificationPermissionPromptProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export function NotificationPermissionPrompt({
  onPermissionGranted,
  onPermissionDenied,
}: NotificationPermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      return;
    }

    // Check current permission status
    const status = Notification.permission;
    setPermissionStatus(status);

    // Show prompt if permission is default (not granted or denied)
    if (status === 'default') {
      // Delay showing the prompt to avoid overwhelming the user
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);

    try {
      const granted = await webNotificationService.initialize();

      if (granted) {
        setPermissionStatus('granted');
        setShowPrompt(false);
        onPermissionGranted?.();
      } else {
        setPermissionStatus('denied');
        setShowPrompt(false);
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setPermissionStatus('denied');
      setShowPrompt(false);
      onPermissionDenied?.();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onPermissionDenied?.();
  };

  if (!showPrompt || permissionStatus !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Enable Notifications
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get workout reminders, nutrition tips, and progress updates
              delivered to your device.
            </p>

            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRequesting ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Enable
                  </>
                )}
              </button>

              <button
                onClick={handleDismiss}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <X className="w-3 h-3 mr-1" />
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationPermissionPrompt;
