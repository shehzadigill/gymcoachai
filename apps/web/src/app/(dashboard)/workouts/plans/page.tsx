'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkoutPlansPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main workouts page with plans view
    // Add a query parameter to indicate we want the plans view active
    router.replace('/workouts?view=plans');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Redirecting to Workout Plans...
        </p>
      </div>
    </div>
  );
}
