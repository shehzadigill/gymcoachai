'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import { useTranslations, useLocale } from 'next-intl';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Play,
  Pause,
  RotateCcw,
  Edit,
  Search,
  X,
  BookOpen,
} from 'lucide-react';

interface LibraryExercise {
  id: string;
  name: string;
  muscle_group: string;
  description?: string;
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

interface Exercise {
  id: string;
  exerciseId?: string; // Reference to library exercise
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  instructions: string;
  completed: boolean;
}

interface WorkoutPlan {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  frequencyPerWeek: number;
  exercises: Exercise[];
  isTemplate?: boolean;
  tags?: string[];
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const locale = useLocale();
  const t = useTranslations('workout_create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>(
    []
  );
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(false);

  const [workout, setWorkout] = useState<WorkoutPlan>({
    name: '',
    description: '',
    difficulty: 'beginner',
    durationWeeks: 4,
    frequencyPerWeek: 3,
    exercises: [],
    isTemplate: false,
    tags: [],
  });

  const [newExercise, setNewExercise] = useState<
    Omit<Exercise, 'id' | 'completed'>
  >({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    restTime: 60,
    instructions: '',
  });

  useEffect(() => {
    // Check if we're creating a template
    const templateParam = searchParams.get('template');
    if (templateParam === 'true') {
      setIsTemplate(true);
      setWorkout((prev) => ({ ...prev, isTemplate: true }));
    }

    // Check if we're creating from a template
    const fromTemplateParam = searchParams.get('fromTemplate');
    if (fromTemplateParam) {
      try {
        const templateData = JSON.parse(decodeURIComponent(fromTemplateParam));

        // Map template exercises to the expected Exercise interface
        const mappedExercises = (templateData.exercises || []).map(
          (ex: any, index: number) => {
            return {
              id: ex.exerciseId || `temp-${index}`,
              exerciseId: ex.exerciseId, // Reference to library exercise
              name: ex.name || '',
              sets: ex.sets || 3,
              reps: ex.reps || 10,
              weight: ex.weight || 0,
              restTime: ex.restSeconds || 60, // Map restSeconds to restTime
              instructions: ex.notes || '',
              completed: false,
            };
          }
        );

        setWorkout((prev) => ({
          ...prev,
          name: `${templateData.name} (Copy)`,
          description: templateData.description || '',
          difficulty: templateData.difficulty || 'beginner',
          durationWeeks: templateData.durationWeeks || 4,
          frequencyPerWeek: templateData.frequencyPerWeek || 3,
          exercises: mappedExercises,
          tags: templateData.tags || [],
          isTemplate: false, // This is a new plan, not a template
        }));
        setIsTemplate(false); // Ensure we're not in template mode
      } catch (error) {
        console.error('Failed to parse template data:', error);
        console.error('Template data that failed:', fromTemplateParam);
        setError(t('failed_to_load_template'));
      }
    }

    // Fetch exercise library
    fetchExercises();
  }, [searchParams]);

  const fetchExercises = async () => {
    try {
      setExercisesLoading(true);
      const exercises = await api.getExercises(user?.id);
      setLibraryExercises(exercises || []);
    } catch (error) {
      console.error('Failed to fetch exercises:', error);
    } finally {
      setExercisesLoading(false);
    }
  };

  const addExerciseFromLibrary = (libraryExercise: LibraryExercise) => {
    const exercise: Exercise = {
      id: Date.now().toString(),
      exerciseId: libraryExercise.id,
      name: libraryExercise.name,
      sets: 3,
      reps: 10,
      weight: 0,
      restTime: 60,
      instructions: libraryExercise.description || '',
      completed: false,
    };

    setWorkout({
      ...workout,
      exercises: [...workout.exercises, exercise],
    });
    setShowExerciseSelection(false);
  };

  const addCustomExercise = (customExerciseData: any) => {
    const exercise: Exercise = {
      id: Date.now().toString(),
      name: customExerciseData.name,
      sets: 3,
      reps: 10,
      weight: 0,
      restTime: 60,
      instructions: customExerciseData.description || '',
      completed: false,
    };

    setWorkout({
      ...workout,
      exercises: [...workout.exercises, exercise],
    });
    setShowCustomExerciseForm(false);
  };

  const addExercise = () => {
    if (newExercise.name.trim()) {
      const exercise: Exercise = {
        ...newExercise,
        id: Date.now().toString(),
        completed: false,
      };
      setWorkout({
        ...workout,
        exercises: [...workout.exercises, exercise],
      });
      setNewExercise({
        name: '',
        sets: 3,
        reps: 10,
        weight: 0,
        restTime: 60,
        instructions: '',
      });
    }
  };

  const removeExercise = (id: string) => {
    setWorkout({
      ...workout,
      exercises: workout.exercises.filter((ex) => ex.id !== id),
    });
  };

  const updateExercise = (id: string, updates: Partial<Exercise>) => {
    setWorkout({
      ...workout,
      exercises: workout.exercises.map((ex) =>
        ex.id === id ? { ...ex, ...updates } : ex
      ),
    });
  };

  const saveWorkout = async () => {
    if (!workout.name.trim()) {
      setError('Workout name is required');
      return;
    }

    if (workout.exercises.length === 0) {
      setError('At least one exercise is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const workoutPlanData = {
        name: workout.name,
        description: workout.description,
        difficulty: workout.difficulty,
        durationWeeks: workout.durationWeeks,
        frequencyPerWeek: workout.frequencyPerWeek,
        exercises: workout.exercises.map(({ id, completed, ...ex }) => ({
          ...ex,
          // Include exerciseId reference if it exists (from library)
          ...(ex.exerciseId && { exerciseId: ex.exerciseId }),
        })),
        // Include template-specific fields
        isTemplate: workout.isTemplate || isTemplate,
        tags: workout.tags || [],
      };

      const response = await api.createWorkoutPlan(workoutPlanData, user?.id);

      if (response) {
        const successMessage = isTemplate
          ? t('template_saved')
          : t('workout_saved');
        setSuccess(successMessage);
        setTimeout(() => {
          // Navigate to templates tab if it's a template, otherwise to my-plans
          const targetView = isTemplate ? 'templates' : 'my-plans';
          router.push(`/${locale}/workouts/plans?view=${targetView}`);
        }, 1500);
      }
    } catch (e: any) {
      console.error('Failed to create workout plan:', e);
      setError(t('failed_to_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isTemplate ? t('create_template_title') : t('create_plan_title')}
            </h1>
            {isTemplate && (
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs font-medium">
                {t('template_badge')}
              </span>
            )}
            {searchParams.get('fromTemplate') && !isTemplate && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                {t('from_template_badge')}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {isTemplate
              ? t('template_subtitle')
              : searchParams.get('fromTemplate')
                ? t('from_template_subtitle')
                : t('build_routine_subtitle')}
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400">{success}</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workout Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('workout_details')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('workout_name')}
                </label>
                <input
                  type="text"
                  value={workout.name}
                  onChange={(e) =>
                    setWorkout({ ...workout, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('workout_name_placeholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('description')}
                </label>
                <textarea
                  value={workout.description}
                  onChange={(e) =>
                    setWorkout({ ...workout, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('description_placeholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('difficulty')}
                </label>
                <select
                  value={workout.difficulty}
                  onChange={(e) =>
                    setWorkout({
                      ...workout,
                      difficulty: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="beginner">{t('beginner')}</option>
                  <option value="intermediate">{t('intermediate')}</option>
                  <option value="advanced">{t('advanced')}</option>
                </select>
              </div>

              {isTemplate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tags')}
                  </label>
                  <input
                    type="text"
                    value={workout.tags?.join(', ') || ''}
                    onChange={(e) =>
                      setWorkout({
                        ...workout,
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter((t) => t),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={t('tags_placeholder')}
                  />
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={workout.isTemplate}
                    onChange={(e) => {
                      setWorkout({ ...workout, isTemplate: e.target.checked });
                      setIsTemplate(e.target.checked);
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('make_template')}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('duration_weeks')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={workout.durationWeeks}
                    onChange={(e) =>
                      setWorkout({
                        ...workout,
                        durationWeeks: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('frequency_week')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={workout.frequencyPerWeek}
                    onChange={(e) =>
                      setWorkout({
                        ...workout,
                        frequencyPerWeek: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Workout Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('workout_summary')}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('exercises_label')}
                </span>
                <span className="font-medium">{workout.exercises.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('total_sets')}
                </span>
                <span className="font-medium">
                  {workout.exercises.reduce((acc, ex) => acc + ex.sets, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('estimated_time')}
                </span>
                <span className="font-medium">
                  {Math.round(
                    workout.exercises.reduce(
                      (acc, ex) => acc + ex.sets * ex.restTime,
                      0
                    ) / 60
                  )}{' '}
                  {t('min')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Exercise Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('add_exercise')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('exercise_name')}
                </label>
                <input
                  type="text"
                  value={newExercise.name}
                  onChange={(e) =>
                    setNewExercise({ ...newExercise, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('exercise_name_placeholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={newExercise.weight}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      weight: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sets
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newExercise.sets}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      sets: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reps
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newExercise.reps}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      reps: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rest Time (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={newExercise.restTime}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      restTime: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructions
                </label>
                <textarea
                  value={newExercise.instructions}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      instructions: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('instructions_placeholder')}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => setShowExerciseSelection(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>{t('from_library')}</span>
                </button>
                <button
                  onClick={() => setShowCustomExerciseForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('custom_exercise')}</span>
                </button>
              </div>
              <button
                onClick={addExercise}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{t('quick_add_manual')}</span>
              </button>
            </div>
          </div>

          {/* Exercise List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('exercises_count_header', { count: workout.exercises.length })}
            </h3>

            {workout.exercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t('no_exercises_added')}</p>
                <p className="text-sm">Add your first exercise above</p>
              </div>
            ) : (
              workout.exercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  onUpdate={(updates) => updateExercise(exercise.id, updates)}
                  onRemove={() => removeExercise(exercise.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={saveWorkout}
          disabled={
            saving || !workout.name.trim() || workout.exercises.length === 0
          }
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>
            {saving
              ? t('saving')
              : isTemplate
                ? t('save_template')
                : t('save_workout_plan')}
          </span>
        </button>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <ExerciseSelectionModal
          exercises={libraryExercises}
          selectedExerciseIds={
            workout.exercises
              .map((ex) => ex.exerciseId)
              .filter(Boolean) as string[]
          }
          onSelect={addExerciseFromLibrary}
          onClose={() => setShowExerciseSelection(false)}
        />
      )}

      {/* Custom Exercise Form Modal */}
      {showCustomExerciseForm && (
        <CustomExerciseModal
          onSave={addCustomExercise}
          onClose={() => setShowCustomExerciseForm(false)}
        />
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  onUpdate,
  onRemove,
}: {
  exercise: Exercise;
  index: number;
  onUpdate: (updates: Partial<Exercise>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('workout_create');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(exercise);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(exercise);
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {index + 1}.
            </span>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {exercise.name}
            </h4>
            {!!exercise.weight && exercise.weight > 0 && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('lbs_label', { weight: exercise.weight })}
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <input
                type="text"
                value={editData.name}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('exercise_name_edit_placeholder')}
              />
              <input
                type="number"
                value={editData.sets}
                onChange={(e) =>
                  setEditData({ ...editData, sets: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('sets_placeholder')}
              />
              <input
                type="number"
                value={editData.reps}
                onChange={(e) =>
                  setEditData({ ...editData, reps: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('reps_placeholder')}
              />
              <input
                type="number"
                value={editData.weight}
                onChange={(e) =>
                  setEditData({ ...editData, weight: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('weight_placeholder')}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span className="flex items-center space-x-1">
                <Target className="h-4 w-4" />
                <span>{t('sets_label', { count: exercise.sets })}</span>
              </span>
              <span className="flex items-center space-x-1">
                <RotateCcw className="h-4 w-4" />
                <span>{t('reps_label', { count: exercise.reps })}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{t('rest_label', { count: exercise.restTime })}</span>
              </span>
            </div>
          )}

          {exercise.instructions && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {exercise.instructions}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="text-green-600 hover:text-green-700 p-1"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={onRemove}
                className="text-red-600 hover:text-red-700 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Exercise Selection Modal Component
function ExerciseSelectionModal({
  exercises,
  selectedExerciseIds = [],
  onSelect,
  onClose,
}: {
  exercises: LibraryExercise[];
  selectedExerciseIds?: string[];
  onSelect: (exercise: LibraryExercise) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workout_create');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMuscleGroup, setFilterMuscleGroup] = useState('all');

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch =
      exercise.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.muscle_group?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscleGroup =
      filterMuscleGroup === 'all' ||
      exercise.muscle_group === filterMuscleGroup;
    return matchesSearch && matchesMuscleGroup;
  });

  const muscleGroups = [
    ...new Set(exercises.map((ex) => ex.muscle_group).filter(Boolean)),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Exercise from Library
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Search and Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_exercises')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterMuscleGroup}
              onChange={(e) => setFilterMuscleGroup(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('all_muscle_groups')}</option>
              {muscleGroups.map((group) => (
                <option key={group} value={group}>
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Exercise List */}
          <div className="overflow-y-auto max-h-96 space-y-2">
            {filteredExercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t('no_exercises_found')}</p>
                <p className="text-sm">Try different search terms or filters</p>
              </div>
            ) : (
              filteredExercises.map((exercise) => {
                const isSelected = selectedExerciseIds.includes(exercise.id);
                return (
                  <div
                    key={exercise.id}
                    className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => !isSelected && onSelect(exercise)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div
                          className={`font-medium ${
                            isSelected
                              ? 'text-blue-900 dark:text-blue-200'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {exercise.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span className="capitalize">
                            {exercise.muscle_group}
                          </span>
                          {exercise.equipment && (
                            <span> • {exercise.equipment}</span>
                          )}
                          {exercise.difficulty && (
                            <span
                              className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                exercise.difficulty === 'beginner'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : exercise.difficulty === 'intermediate'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}
                            >
                              {exercise.difficulty}
                            </span>
                          )}
                        </div>
                        {exercise.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {exercise.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="text-blue-600 dark:text-blue-400 text-sm font-medium ml-4">
                          {t('added_badge')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom Exercise Modal Component
function CustomExerciseModal({
  onSave,
  onClose,
}: {
  onSave: (exercise: any) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workout_create');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    muscle_group: '',
    equipment: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Custom Exercise
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exercise Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('custom_exercise_name_placeholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('description_custom_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Muscle Group
            </label>
            <input
              type="text"
              value={formData.muscle_group}
              onChange={(e) =>
                setFormData({ ...formData, muscle_group: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('muscle_group_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Equipment
            </label>
            <input
              type="text"
              value={formData.equipment}
              onChange={(e) =>
                setFormData({ ...formData, equipment: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('equipment_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Difficulty
            </label>
            <select
              value={formData.difficulty}
              onChange={(e) =>
                setFormData({ ...formData, difficulty: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="beginner">{t('beginner')}</option>
              <option value="intermediate">{t('intermediate')}</option>
              <option value="advanced">{t('advanced')}</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.name.trim()}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg"
            >
              Add Exercise
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
