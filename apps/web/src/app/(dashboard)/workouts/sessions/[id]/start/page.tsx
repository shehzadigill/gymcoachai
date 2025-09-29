'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { api } from '../../../../../../lib/api-client';

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
  const params = useParams();
  const sessionId = params.id as string;

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
    fetchSession();
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
      const response = await api.getWorkoutSession(sessionId);
      console.log('Session response:', response);

      if (response) {
        let data = response;
        if (data && typeof data === 'object' && 'body' in data) {
          data =
            typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        }

        setSession(data);
        // Fetch detailed exercise information
        await fetchExerciseDetails(data.exercises);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      setError('Failed to load workout session');
    } finally {
      setLoading(false);
    }
  };

  const fetchExerciseDetails = async (exercises: SessionExercise[]) => {
    try {
      setLoadingExerciseDetails(true);
      const detailsMap: { [key: string]: ExerciseDetails } = {};

      // Fetch details for each unique exercise
      const uniqueExerciseIds = [
        ...new Set(exercises.map((ex) => ex.exercise_id)),
      ];

      await Promise.all(
        uniqueExerciseIds.map(async (exerciseId) => {
          try {
            const details = await api.getExercise(exerciseId);
            if (details) {
              // Transform API response to match our interface
              detailsMap[exerciseId] = {
                id: details.id || details.ExerciseId || exerciseId,
                name: details.name || details.Name || 'Unknown Exercise',
                description: details.description || details.Description,
                category: details.category || details.Category || 'general',
                muscle_groups:
                  details.muscle_groups ||
                  (details.MuscleGroups
                    ? JSON.parse(details.MuscleGroups)
                    : []),
                equipment:
                  details.equipment ||
                  (details.Equipment ? JSON.parse(details.Equipment) : []),
                difficulty:
                  details.difficulty || details.Difficulty || 'beginner',
                instructions:
                  details.instructions ||
                  (details.Instructions
                    ? JSON.parse(details.Instructions)
                    : []),
                tips: details.tips || details.Tips,
                video_url: details.video_url || details.videoUrl,
                image_url: details.image_url || details.imageUrl,
              };
            }
          } catch (error) {
            console.error(
              `Failed to fetch details for exercise ${exerciseId}:`,
              error
            );
            // Create a fallback details object
            detailsMap[exerciseId] = {
              id: exerciseId,
              name:
                exercises.find((ex) => ex.exercise_id === exerciseId)
                  ?.exercise_name || 'Unknown Exercise',
              category: 'general',
              muscle_groups: [],
              equipment: [],
              difficulty: 'beginner',
              instructions: [],
            };
          }
        })
      );

      setExerciseDetails(detailsMap);
    } catch (error) {
      console.error('Error fetching exercise details:', error);
    } finally {
      setLoadingExerciseDetails(false);
    }
  };

  const startSession = () => {
    setIsSessionActive(true);
    setSessionStartTime(new Date());
  };

  const pauseSession = () => {
    setIsSessionActive(false);
  };

  const resumeSession = () => {
    setIsSessionActive(true);
  };

  const completeSet = () => {
    if (!session) return;

    const updatedSession = { ...session };
    const currentExercise = updatedSession.exercises[currentExerciseIndex];
    const currentSet = currentExercise.sets[currentSetIndex];

    currentSet.completed = true;

    // Start rest timer if there's a rest time configured
    if (currentSet.rest_seconds && currentSet.rest_seconds > 0) {
      setRestTimer(currentSet.rest_seconds);
      setIsResting(true);
    }

    setSession(updatedSession);

    // Move to next set or exercise
    if (currentSetIndex < currentExercise.sets.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < updatedSession.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const updateSetValue = (field: 'reps' | 'weight', value: number) => {
    if (!session) return;

    const updatedSession = { ...session };
    const currentSet =
      updatedSession.exercises[currentExerciseIndex].sets[currentSetIndex];
    currentSet[field] = value;
    setSession(updatedSession);
  };

  const completeSession = async () => {
    if (!session) return;

    try {
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
      await api.updateWorkoutSession(sessionId, {
        name: session.name,
        startedAt:
          sessionStartTime?.toISOString() ||
          session.started_at ||
          session.created_at ||
          new Date().toISOString(),
        completedAt: new Date().toISOString(), // This marks the session as completed
        completed: true, // Explicitly mark as completed for clarity
        durationMinutes: Math.floor(totalTime / 60),
        exercises: transformedExercises,
        notes: session.notes || null,
        rating: session.rating || null,
        createdAt: session.created_at || new Date().toISOString(),
        workoutPlanId: session.workout_plan_id || null,
      });

      router.push('/workouts/sessions');
    } catch (error) {
      console.error('Error completing session:', error);
      setError('Failed to complete session');
    }
  };

  const skipRest = () => {
    setIsResting(false);
    setRestTimer(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">
            {error || 'Session not found'}
          </p>
          <button
            onClick={() => router.push('/workouts/sessions')}
            className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            ← Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = session.exercises[currentExerciseIndex];
  const currentSet = currentExercise?.sets[currentSetIndex];
  const isLastExercise = currentExerciseIndex === session.exercises.length - 1;
  const isLastSet = currentSetIndex === currentExercise?.sets.length - 1;
  const allSetsCompleted = session.exercises.every((ex) =>
    ex.sets.every((set) => set.completed)
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/workouts/sessions')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {session.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {session.difficulty} • {session.exercises.length} exercises
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-lg font-mono">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-gray-900 dark:text-white">
              {formatTime(totalTime)}
            </span>
          </div>

          {!isSessionActive && !sessionStartTime ? (
            <button
              onClick={startSession}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Start</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              {isSessionActive ? (
                <button
                  onClick={pauseSession}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Pause className="h-4 w-4" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={resumeSession}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Resume</span>
                </button>
              )}

              {allSetsCompleted && (
                <button
                  onClick={completeSession}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Complete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rest Timer */}
      {isResting && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center space-x-4">
            <Timer className="h-8 w-8 text-orange-600" />
            <div>
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                Rest Time
              </h3>
              <p className="text-3xl font-mono font-bold text-orange-600">
                {formatTime(restTimer)}
              </p>
            </div>
          </div>
          <button
            onClick={skipRest}
            className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
          >
            <SkipForward className="h-4 w-4" />
            <span>Skip Rest</span>
          </button>
        </div>
      )}

      {/* Current Exercise */}
      {currentExercise && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentExercise.exercise_name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Exercise {currentExerciseIndex + 1} of{' '}
                {session.exercises.length}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set {currentSetIndex + 1} of {currentExercise.sets.length}
              </p>
              <div className="flex space-x-1 mt-1">
                {currentExercise.sets.map((set, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${
                      set.completed
                        ? 'bg-green-500'
                        : index === currentSetIndex
                          ? 'bg-blue-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Exercise Details */}
          {exerciseDetails[currentExercise.exercise_id] && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Category:
                  </span>
                  <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs capitalize">
                    {exerciseDetails[currentExercise.exercise_id].category}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Difficulty:
                  </span>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs capitalize ${
                      exerciseDetails[currentExercise.exercise_id]
                        .difficulty === 'beginner'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : exerciseDetails[currentExercise.exercise_id]
                              .difficulty === 'intermediate'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {exerciseDetails[currentExercise.exercise_id].difficulty}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Equipment:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {exerciseDetails[currentExercise.exercise_id].equipment
                      .length > 0 ? (
                      exerciseDetails[
                        currentExercise.exercise_id
                      ].equipment.map((eq, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs capitalize"
                        >
                          {eq}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        None required
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {exerciseDetails[currentExercise.exercise_id].muscle_groups
                .length > 0 && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                    Target Muscles:
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {exerciseDetails[
                      currentExercise.exercise_id
                    ].muscle_groups.map((muscle, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm capitalize font-medium"
                      >
                        {muscle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {exerciseDetails[currentExercise.exercise_id].description && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {exerciseDetails[currentExercise.exercise_id].description}
                  </p>
                </div>
              )}

              {exerciseDetails[currentExercise.exercise_id].instructions
                .length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instructions
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {exerciseDetails[
                      currentExercise.exercise_id
                    ].instructions.map((instruction, index) => (
                      <li key={index} className="leading-relaxed">
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {exerciseDetails[currentExercise.exercise_id].tips && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    💡 Tips
                  </h4>
                  <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg leading-relaxed">
                    {exerciseDetails[currentExercise.exercise_id].tips}
                  </p>
                </div>
              )}

              {(exerciseDetails[currentExercise.exercise_id].video_url ||
                exerciseDetails[currentExercise.exercise_id].image_url) && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📹 Media
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {exerciseDetails[currentExercise.exercise_id].video_url && (
                      <a
                        href={
                          exerciseDetails[currentExercise.exercise_id].video_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Watch Video
                      </a>
                    )}
                    {exerciseDetails[currentExercise.exercise_id].image_url && (
                      <a
                        href={
                          exerciseDetails[currentExercise.exercise_id].image_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                      >
                        <Dumbbell className="h-4 w-4 mr-2" />
                        View Image
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {loadingExerciseDetails && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {/* Current Set Details */}
          {currentSet && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                {currentSet.reps && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reps
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          updateSetValue(
                            'reps',
                            Math.max(1, (currentSet.reps || 1) - 1)
                          )
                        }
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-lg font-mono font-semibold text-gray-900 dark:text-white min-w-[3rem] text-center">
                        {currentSet.reps}
                      </span>
                      <button
                        onClick={() =>
                          updateSetValue('reps', (currentSet.reps || 0) + 1)
                        }
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentSet.weight !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Weight (lbs)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          updateSetValue(
                            'weight',
                            Math.max(0, (currentSet.weight || 0) - 5)
                          )
                        }
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-lg font-mono font-semibold text-gray-900 dark:text-white min-w-[3rem] text-center">
                        {currentSet.weight || 0}
                      </span>
                      <button
                        onClick={() =>
                          updateSetValue('weight', (currentSet.weight || 0) + 5)
                        }
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Set Actions */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (currentSetIndex > 0) {
                    setCurrentSetIndex(currentSetIndex - 1);
                  } else if (currentExerciseIndex > 0) {
                    setCurrentExerciseIndex(currentExerciseIndex - 1);
                    setCurrentSetIndex(
                      session.exercises[currentExerciseIndex - 1].sets.length -
                        1
                    );
                  }
                }}
                disabled={currentExerciseIndex === 0 && currentSetIndex === 0}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  if (currentSetIndex < currentExercise.sets.length - 1) {
                    setCurrentSetIndex(currentSetIndex + 1);
                  } else if (
                    currentExerciseIndex <
                    session.exercises.length - 1
                  ) {
                    setCurrentExerciseIndex(currentExerciseIndex + 1);
                    setCurrentSetIndex(0);
                  }
                }}
                disabled={isLastExercise && isLastSet}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={completeSet}
              disabled={currentSet?.completed}
              className={`px-6 py-2 rounded-lg flex items-center space-x-2 ${
                currentSet?.completed
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              <span>
                {currentSet?.completed ? 'Completed' : 'Complete Set'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Exercise List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Exercise Progress
        </h3>
        <div className="space-y-3">
          {session.exercises.map((exercise, exerciseIndex) => {
            const details = exerciseDetails[exercise.exercise_id];
            return (
              <div
                key={exerciseIndex}
                className={`p-4 rounded-lg border transition-all ${
                  exerciseIndex === currentExerciseIndex
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {exercise.exercise_name}
                    </h4>
                    {details && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            details.difficulty === 'beginner'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : details.difficulty === 'intermediate'
                                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}
                        >
                          {details.difficulty}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs capitalize">
                          {details.category}
                        </span>
                      </div>
                    )}
                    {details && details.muscle_groups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {details.muscle_groups
                          .slice(0, 3)
                          .map((muscle, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs capitalize"
                            >
                              {muscle}
                            </span>
                          ))}
                        {details.muscle_groups.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{details.muscle_groups.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-1 ml-4">
                    {exercise.sets.map((set, setIndex) => (
                      <div
                        key={setIndex}
                        className={`w-2 h-2 rounded-full ${
                          set.completed
                            ? 'bg-green-500'
                            : exerciseIndex === currentExerciseIndex &&
                                setIndex === currentSetIndex
                              ? 'bg-blue-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {exercise.sets.length} sets •{' '}
                  {exercise.sets.filter((set) => set.completed).length}{' '}
                  completed
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
