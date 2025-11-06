'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Play,
  Pause,
  Square,
  Clock,
  CheckCircle,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Timer,
  Dumbbell,
  Plus,
  Minus,
  Save,
  X,
} from 'lucide-react';
import { api } from '../../../../../lib/api-client';

interface WorkoutSession {
  id: string;
  name: string;
  date?: string;
  workout_plan_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  exercises: SessionExercise[];
  completed?: boolean; // Computed field for frontend convenience
  notes?: string;
  rating?: number;
  created_at: string;
  updated_at: string;
}

interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
  sets: ExerciseSet[];
  notes?: string;
  order: number;
  // Full exercise details fetched separately
  details?: ExerciseDetails;
}

interface ExerciseDetails {
  id: string;
  name: string;
  description?: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  tips?: string;
  video_url?: string;
  image_url?: string;
}

interface ExerciseSet {
  set_number: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  rest_seconds?: number;
  completed: boolean;
  notes?: string;
}

export default function StartSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [totalTime, setTotalTime] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState<{
    [key: string]: ExerciseDetails;
  }>({});
  const [loadingExerciseDetails, setLoadingExerciseDetails] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
    } else {
      setError('No session ID provided');
      setLoading(false);
    }
  }, [sessionId]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && sessionStartTime) {
      interval = setInterval(() => {
        setTotalTime(
          Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime]);

  // Rest timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const sessionData = await api.getWorkoutSession(sessionId!);
      setSession(sessionData);

      // Check if session was already started
      if (sessionData.started_at && !sessionData.completed_at) {
        setIsSessionActive(true);
        setSessionStartTime(new Date(sessionData.started_at));
      }

      // Fetch exercise details for better UI
      await fetchExerciseDetails(sessionData.exercises);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to load workout session');
    } finally {
      setLoading(false);
    }
  };

  const fetchExerciseDetails = async (exercises: SessionExercise[]) => {
    setLoadingExerciseDetails(true);
    const details: { [key: string]: ExerciseDetails } = {};

    for (const exercise of exercises) {
      try {
        const exerciseDetail = await api.getExercise(exercise.exercise_id);
        details[exercise.exercise_id] = exerciseDetail;
      } catch (err) {
        console.warn(
          `Failed to fetch details for exercise ${exercise.exercise_id}:`,
          err
        );
      }
    }

    setExerciseDetails(details);
    setLoadingExerciseDetails(false);
  };

  const startSession = async () => {
    if (!session) return;

    try {
      const startTime = new Date();

      // Transform exercises to match backend expected format
      const transformedExercises = session.exercises.map((exercise, index) => ({
        exerciseId: exercise.exercise_id,
        name: exercise.exercise_name,
        notes: exercise.notes || null,
        order: index,
        sets: exercise.sets.map((set) => ({
          setNumber: set.set_number,
          reps: set.reps || null,
          weight: set.weight || null,
          durationSeconds: set.duration_seconds || null,
          restSeconds: set.rest_seconds || null,
          completed: set.completed,
          notes: set.notes || null,
        })),
      }));

      const updateData = {
        name: session.name,
        startedAt: startTime.toISOString(),
        exercises: transformedExercises,
        notes: session.notes || null,
        rating: session.rating || null,
        completedAt: session.completed_at || null,
        completed: !!session.completed_at,
        durationMinutes: session.duration_minutes || null,
        workoutPlanId: session.workout_plan_id || null,
      };

      await api.updateWorkoutSession(session.id, updateData);

      setIsSessionActive(true);
      setSessionStartTime(startTime);
      setSession({
        ...session,
        started_at: startTime.toISOString(),
      });
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Failed to start session');
    }
  };

  const pauseSession = () => {
    setIsSessionActive(false);
  };

  const resumeSession = () => {
    setIsSessionActive(true);
  };

  const completeSet = async () => {
    if (!session) return;

    const currentExercise = session.exercises[currentExerciseIndex];
    const currentSet = currentExercise.sets[currentSetIndex];

    // Mark set as completed
    const updatedSession = { ...session };
    updatedSession.exercises[currentExerciseIndex].sets[
      currentSetIndex
    ].completed = true;

    setSession(updatedSession);

    // Save to backend with proper data format
    try {
      // Transform exercises to match backend expected format
      const transformedExercises = updatedSession.exercises.map(
        (exercise, index) => ({
          exerciseId: exercise.exercise_id,
          name: exercise.exercise_name,
          notes: exercise.notes || null,
          order: index,
          sets: exercise.sets.map((set) => ({
            setNumber: set.set_number,
            reps: set.reps || null,
            weight: set.weight || null,
            durationSeconds: set.duration_seconds || null,
            restSeconds: set.rest_seconds || null,
            completed: set.completed,
            notes: set.notes || null,
          })),
        })
      );

      const updateData = {
        name: updatedSession.name,
        exercises: transformedExercises,
        notes: updatedSession.notes || null,
        rating: updatedSession.rating || null,
        startedAt: updatedSession.started_at || updatedSession.created_at,
        completedAt: updatedSession.completed_at || null,
        completed: !!updatedSession.completed_at,
        durationMinutes: updatedSession.duration_minutes || null,
        workoutPlanId: updatedSession.workout_plan_id || null,
      };

      await api.updateWorkoutSession(session.id, updateData);
    } catch (err) {
      console.error('Error updating session:', err);
    }

    // Start rest timer if there's a rest period
    if (currentSet.rest_seconds && currentSet.rest_seconds > 0) {
      setRestTimer(currentSet.rest_seconds);
      setIsResting(true);
    }

    // Move to next set or exercise
    if (currentSetIndex < currentExercise.sets.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < session.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const completeSession = async () => {
    if (!session) return;

    try {
      const completedAt = new Date();
      const durationMinutes = sessionStartTime
        ? Math.round(
            (completedAt.getTime() - sessionStartTime.getTime()) / (1000 * 60)
          )
        : 0;

      // Transform exercises to match backend expected format
      const transformedExercises = session.exercises.map((exercise, index) => ({
        exerciseId: exercise.exercise_id,
        name: exercise.exercise_name,
        notes: exercise.notes || null,
        order: index,
        sets: exercise.sets.map((set) => ({
          setNumber: set.set_number,
          reps: set.reps || null,
          weight: set.weight || null,
          durationSeconds: set.duration_seconds || null,
          restSeconds: set.rest_seconds || null,
          completed: set.completed,
          notes: set.notes || null,
        })),
      }));

      // Send data in the format expected by the backend
      const completedSession = {
        name: session.name,
        startedAt:
          sessionStartTime?.toISOString() ||
          session.started_at ||
          session.created_at ||
          new Date().toISOString(),
        completedAt: completedAt.toISOString(),
        completed: true,
        durationMinutes: durationMinutes,
        exercises: transformedExercises,
        notes: session.notes || null,
        rating: session.rating || null,
        createdAt: session.created_at || new Date().toISOString(),
        workoutPlanId: session.workout_plan_id || null,
      };

      await api.updateWorkoutSession(session.id, completedSession);

      // Navigate to session detail with completion success
      router.push(`/workouts/session-detail?id=${session.id}&completed=true`);
    } catch (err) {
      console.error('Error completing session:', err);
      setError('Failed to complete session');
    }
  };

  const updateSetValue = async (field: 'reps' | 'weight', value: number) => {
    if (!session) return;

    const updatedSession = { ...session };
    const currentSet =
      updatedSession.exercises[currentExerciseIndex].sets[currentSetIndex];

    if (field === 'reps') {
      currentSet.reps = Math.max(0, value);
    } else if (field === 'weight') {
      currentSet.weight = Math.max(0, value);
    }

    setSession(updatedSession);

    // Save to backend with proper data format
    try {
      // Transform exercises to match backend expected format
      const transformedExercises = updatedSession.exercises.map(
        (exercise, index) => ({
          exerciseId: exercise.exercise_id,
          name: exercise.exercise_name,
          notes: exercise.notes || null,
          order: index,
          sets: exercise.sets.map((set) => ({
            setNumber: set.set_number,
            reps: set.reps || null,
            weight: set.weight || null,
            durationSeconds: set.duration_seconds || null,
            restSeconds: set.rest_seconds || null,
            completed: set.completed,
            notes: set.notes || null,
          })),
        })
      );

      const updateData = {
        name: updatedSession.name,
        exercises: transformedExercises,
        notes: updatedSession.notes || null,
        rating: updatedSession.rating || null,
        startedAt: updatedSession.started_at || updatedSession.created_at,
        completedAt: updatedSession.completed_at || null,
        completed: !!updatedSession.completed_at,
        durationMinutes: updatedSession.duration_minutes || null,
        workoutPlanId: updatedSession.workout_plan_id || null,
      };

      await api.updateWorkoutSession(session.id, updateData);
    } catch (err) {
      console.error('Error updating session:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || 'Session not found'}
          </p>
          <button
            onClick={() => router.push('/workouts')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = session.exercises[currentExerciseIndex];
  const currentSet = currentExercise?.sets[currentSetIndex];
  const currentExerciseDetails = exerciseDetails[currentExercise?.exercise_id];

  const allSetsCompleted = session.exercises.every((exercise) =>
    exercise.sets.every((set) => set.completed)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {session.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Timer className="h-4 w-4" />
                    {formatTime(totalTime)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Dumbbell className="h-4 w-4" />
                    Exercise {currentExerciseIndex + 1} of{' '}
                    {session.exercises.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isSessionActive && !session.started_at && (
                <button
                  onClick={startSession}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Play className="h-4 w-4" />
                  Start Session
                </button>
              )}

              {isSessionActive && (
                <button
                  onClick={pauseSession}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              )}

              {!isSessionActive &&
                session.started_at &&
                !session.completed_at && (
                  <button
                    onClick={resumeSession}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </button>
                )}

              {allSetsCompleted && (
                <button
                  onClick={completeSession}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Complete Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rest Timer Overlay */}
      {isResting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg text-center">
            <Timer className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Rest Time
            </h3>
            <div className="text-4xl font-mono font-bold text-blue-600 mb-4">
              {formatRestTime(restTimer)}
            </div>
            <button
              onClick={() => {
                setIsResting(false);
                setRestTimer(0);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Skip Rest
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentExercise && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* Exercise Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentExercise.exercise_name}
                </h2>
                {currentExerciseDetails && (
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="capitalize">
                      {currentExerciseDetails.category}
                    </span>
                    <span className="capitalize">
                      {currentExerciseDetails.difficulty}
                    </span>
                    {currentExerciseDetails.muscle_groups.length > 0 && (
                      <span>
                        {currentExerciseDetails.muscle_groups.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (currentExerciseIndex > 0) {
                      setCurrentExerciseIndex(currentExerciseIndex - 1);
                      setCurrentSetIndex(0);
                    }
                  }}
                  disabled={currentExerciseIndex === 0}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (currentExerciseIndex < session.exercises.length - 1) {
                      setCurrentExerciseIndex(currentExerciseIndex + 1);
                      setCurrentSetIndex(0);
                    }
                  }}
                  disabled={
                    currentExerciseIndex === session.exercises.length - 1
                  }
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Current Set */}
            {currentSet && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Set {currentSet.set_number} of {currentExercise.sets.length}
                  </h3>
                  {currentSet.completed && (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* Reps */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reps
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateSetValue('reps', (currentSet.reps || 0) - 1)
                        }
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
                        {currentSet.reps || 0}
                      </span>
                      <button
                        onClick={() =>
                          updateSetValue('reps', (currentSet.reps || 0) + 1)
                        }
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Weight (kg)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateSetValue(
                            'weight',
                            Math.max(0, (currentSet.weight || 0) - 2.5)
                          )
                        }
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white min-w-[80px] text-center">
                        {currentSet.weight || 0}
                      </span>
                      <button
                        onClick={() =>
                          updateSetValue(
                            'weight',
                            (currentSet.weight || 0) + 2.5
                          )
                        }
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {!currentSet.completed && (
                  <button
                    onClick={completeSet}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Complete Set
                  </button>
                )}
              </div>
            )}

            {/* Exercise Instructions */}
            {currentExerciseDetails?.instructions && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                  {currentExerciseDetails.instructions.map((instruction, i) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* All Sets Progress */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Sets Progress
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {currentExercise.sets.map((set, index) => (
                  <div
                    key={set.set_number}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      index === currentSetIndex
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : set.completed
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Set {set.set_number}
                      </span>
                      {set.completed && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {set.reps || 0} reps × {set.weight || 0} kg
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
