'use client';

import { useEffect, useState } from 'react';
import { notificationService } from '../lib/notifications';

export function NotificationInitializer() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Ensure we're in the browser
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Initialize notifications when component mounts
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();
  }, [isClient]);

  return null; // This component doesn't render anything
}
