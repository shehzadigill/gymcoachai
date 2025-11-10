'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import ExerciseFormModal from '../../../../../components/modals/ExerciseFormModal';

export default function CreateExercisePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const locale = useLocale();
  const t = useTranslations('workout_exercises');
  const [loading, setLoading] = useState(false);

  const handleSaveExercise = async (exerciseData: any) => {
    try {
      setLoading(true);

      // Create the exercise using the API
      const response = await api.createExercise(exerciseData);

      if (response && response.id) {
        // Redirect back to exercise library with success message
        router.push(`/${locale}/workouts/exercises?success=created`);
      }
    } catch (error: any) {
      console.error('Failed to create exercise:', error);
      // Handle error (could show toast notification)
      alert(error.message || 'Failed to create exercise');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.push(`/${locale}/workouts/exercises`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleClose}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Exercise Library
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Create New Exercise
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Add a custom exercise to your library
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <ExerciseFormModal
            onSave={handleSaveExercise}
            onClose={handleClose}
          />
        </div>
      </div>
    </div>
  );
}
