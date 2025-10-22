'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Plus,
  Search,
  Filter,
  Dumbbell,
  Clock,
  Target,
  Edit,
  Trash2,
  Play,
  Info,
} from 'lucide-react';

interface Exercise {
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
  created_at: string;
  updated_at: string;
}

const categories = ['All', 'strength', 'cardio', 'flexibility', 'sports'];

const difficulties = ['All', 'beginner', 'intermediate', 'advanced'];

export default function ExerciseLibraryPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('All');

  // Modal state
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null
  );

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [
    exercises,
    searchTerm,
    selectedCategory,
    selectedDifficulty,
    selectedMuscleGroup,
  ]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getExercises();
      if (response && Array.isArray(response)) {
        // Transform API response to match frontend format
        const transformedExercises: Exercise[] = response.map(
          (exercise: any) => ({
            id: exercise.id || exercise.ExerciseId,
            name: exercise.name || exercise.Name,
            description: exercise.description || exercise.Description,
            category: exercise.category || exercise.Category,
            muscle_groups:
              exercise.muscle_groups ||
              (exercise.MuscleGroups ? JSON.parse(exercise.MuscleGroups) : []),
            equipment:
              exercise.equipment ||
              (exercise.Equipment ? JSON.parse(exercise.Equipment) : []),
            difficulty: exercise.difficulty || exercise.Difficulty,
            instructions:
              exercise.instructions ||
              (exercise.Instructions ? JSON.parse(exercise.Instructions) : []),
            tips: exercise.tips || exercise.Tips,
            video_url: exercise.video_url || exercise.VideoUrl,
            image_url: exercise.image_url || exercise.ImageUrl,
            created_at: exercise.created_at || exercise.CreatedAt,
            updated_at: exercise.updated_at || exercise.UpdatedAt,
          })
        );
        setExercises(transformedExercises);
      } else {
        setError('No exercises found');
        setExercises([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch exercises:', e);
      setError(e.message || 'Failed to fetch exercises');
      setExercises([]);
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = [...exercises];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exercise.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          exercise.muscle_groups.some((mg) =>
            mg.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(
        (exercise) => exercise.category === selectedCategory
      );
    }

    // Difficulty filter
    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(
        (exercise) => exercise.difficulty === selectedDifficulty
      );
    }

    // Muscle group filter
    if (selectedMuscleGroup !== 'All') {
      filtered = filtered.filter((exercise) =>
        exercise.muscle_groups.includes(selectedMuscleGroup.toLowerCase())
      );
    }

    setFilteredExercises(filtered);
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return;

    try {
      await api.deleteExercise(exerciseId);
      setExercises(exercises.filter((e) => e.id !== exerciseId));
    } catch (e: any) {
      console.error('Failed to delete exercise:', e);
      alert('Failed to delete exercise');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'cardio':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'flexibility':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'sports':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  // Get all unique muscle groups for filter
  const allMuscleGroups = [
    'All',
    ...Array.from(new Set(exercises.flatMap((e) => e.muscle_groups))),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Exercise Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and manage your exercise database
          </p>
        </div>
        <button
          onClick={() => router.push('/workouts/exercises/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Exercise</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'All'
                    ? 'All Categories'
                    : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {difficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty === 'All'
                    ? 'All Levels'
                    : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Muscle Group Filter */}
          <div>
            <select
              value={selectedMuscleGroup}
              onChange={(e) => setSelectedMuscleGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {allMuscleGroups.map((muscle) => (
                <option key={muscle} value={muscle}>
                  {muscle === 'All'
                    ? 'All Muscles'
                    : muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Exercises
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {exercises.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Filtered Results
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {filteredExercises.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Filter className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Categories
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {new Set(exercises.map((e) => e.category)).size}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Muscle Groups
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {allMuscleGroups.length - 1}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Grid */}
      {filteredExercises.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No exercises found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or add a new exercise.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {/* Exercise Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {exercise.name}
                  </h3>
                  {exercise.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {exercise.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(exercise.category)}`}
                >
                  {exercise.category}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(exercise.difficulty)}`}
                >
                  {exercise.difficulty}
                </span>
              </div>

              {/* Muscle Groups */}
              <div className="mb-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Muscle Groups:
                </div>
                <div className="flex flex-wrap gap-1">
                  {exercise.muscle_groups.map((muscle, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              {exercise.equipment.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Equipment:
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {exercise.equipment.join(', ')}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedExercise(exercise)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm flex items-center justify-center space-x-1"
                >
                  <Info className="h-4 w-4" />
                  <span>Details</span>
                </button>
                <button
                  onClick={() =>
                    router.push(`/workouts/exercises/edit/${exercise.id}`)
                  }
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteExercise(exercise.id)}
                  className="bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercise Details Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedExercise.name}
                </h2>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedExercise.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedExercise.description}
                </p>
              )}

              <div className="space-y-4">
                {/* Instructions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Instructions
                  </h3>
                  <ol className="list-decimal list-inside space-y-2">
                    {selectedExercise.instructions.map((instruction, index) => (
                      <li
                        key={index}
                        className="text-gray-700 dark:text-gray-300"
                      >
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Tips */}
                {selectedExercise.tips && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Tips
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedExercise.tips}
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Category
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedExercise.category}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Difficulty
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedExercise.difficulty}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Muscle Groups
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedExercise.muscle_groups.join(', ')}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Equipment
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedExercise.equipment.join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    router.push(
                      `/workouts/exercises/edit/${selectedExercise.id}`
                    );
                    setSelectedExercise(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Edit Exercise
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
