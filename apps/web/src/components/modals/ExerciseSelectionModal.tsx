'use client';

import { useState, useEffect } from 'react';
import { X, Search, Plus, Filter } from 'lucide-react';
import { api } from '../../lib/api-client';

interface ExerciseLibraryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  tips?: string;
  videoUrl?: string;
  imageUrl?: string;
  createdBy?: string;
  isSystem: boolean;
  tags: string[];
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  weight?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
}

interface ExerciseSelectionModalProps {
  onClose: () => void;
  onExerciseAdd: (exercise: ExerciseLibraryItem) => void;
  onCreateNew: () => void;
  selectedExercises?: WorkoutExercise[];
}

export default function ExerciseSelectionModal({
  onClose,
  onExerciseAdd,
  onCreateNew,
  selectedExercises = [],
}: ExerciseSelectionModalProps) {
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<
    ExerciseLibraryItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const selectedExerciseIds = selectedExercises.map((ex) => ex.exerciseId);

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [
    exercises,
    searchTerm,
    categoryFilter,
    muscleGroupFilter,
    difficultyFilter,
  ]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getExercises();

      if (response && Array.isArray(response)) {
        const exerciseItems: ExerciseLibraryItem[] = response.map(
          (exercise: any) => ({
            id: exercise.id,
            name: exercise.name,
            description: exercise.description,
            category: exercise.category,
            muscleGroups: exercise.muscle_groups || exercise.muscleGroups || [],
            equipment: exercise.equipment || [],
            difficulty: exercise.difficulty || 'beginner',
            instructions: exercise.instructions || [],
            tips: exercise.tips,
            videoUrl: exercise.video_url || exercise.videoUrl,
            imageUrl: exercise.image_url || exercise.imageUrl,
            createdBy: exercise.created_by || exercise.createdBy,
            isSystem: exercise.is_system || exercise.isSystem || false,
            tags: exercise.tags || [],
          })
        );
        setExercises(exerciseItems);
      } else {
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
    let filtered = exercises;

    if (searchTerm) {
      filtered = filtered.filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exercise.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          exercise.muscleGroups.some((muscle) =>
            muscle.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(
        (exercise) => exercise.category === categoryFilter
      );
    }

    if (muscleGroupFilter !== 'all') {
      filtered = filtered.filter((exercise) =>
        exercise.muscleGroups.includes(muscleGroupFilter)
      );
    }

    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(
        (exercise) => exercise.difficulty === difficultyFilter
      );
    }

    setFilteredExercises(filtered);
  };

  const handleExerciseSelect = (exercise: ExerciseLibraryItem) => {
    if (selectedExerciseIds.includes(exercise.id)) {
      return; // Already selected
    }
    onExerciseAdd(exercise);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'intermediate':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'advanced':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Add Exercises to Workout
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </button>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New</span>
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="flexibility">Flexibility</option>
                    <option value="sports">Sports</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Muscle Group
                  </label>
                  <select
                    value={muscleGroupFilter}
                    onChange={(e) => setMuscleGroupFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Muscle Groups</option>
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="arms">Arms</option>
                    <option value="legs">Legs</option>
                    <option value="glutes">Glutes</option>
                    <option value="core">Core</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Difficulties</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No exercises found matching your criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredExercises.map((exercise) => {
                const isSelected = selectedExerciseIds.includes(exercise.id);
                return (
                  <div
                    key={exercise.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                    }`}
                    onClick={() => handleExerciseSelect(exercise)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {exercise.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {exercise.isSystem ? (
                          <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                            System
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {exercise.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(exercise.difficulty)}`}
                      >
                        {exercise.difficulty}
                      </span>
                    </div>

                    {exercise.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {exercise.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {exercise.muscleGroups
                        .slice(0, 3)
                        .map((muscle, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                          >
                            {muscle}
                          </span>
                        ))}
                      {exercise.muscleGroups.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          +{exercise.muscleGroups.length - 3}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                        ✓ Added to workout
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedExercises.length} exercise
              {selectedExercises.length !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
