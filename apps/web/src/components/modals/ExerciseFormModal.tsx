'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

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

interface ExerciseFormModalProps {
  exercise?: ExerciseLibraryItem;
  onSave: (exercise: Partial<ExerciseLibraryItem>) => Promise<void>;
  onClose: () => void;
}

export default function ExerciseFormModal({
  exercise,
  onSave,
  onClose,
}: ExerciseFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'strength',
    muscleGroups: [] as string[],
    equipment: [] as string[],
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    instructions: [''] as string[],
    tips: '',
    videoUrl: '',
    imageUrl: '',
  });

  const [loading, setLoading] = useState(false);
  const [newMuscleGroup, setNewMuscleGroup] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  const muscleGroupOptions = [
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'glutes',
    'core',
    'cardio',
  ];

  const equipmentOptions = [
    'barbell',
    'dumbbell',
    'kettlebell',
    'resistance band',
    'pull-up bar',
    'bench',
    'cable machine',
    'smith machine',
    'treadmill',
    'bike',
    'none',
  ];

  useEffect(() => {
    if (exercise) {
      setFormData({
        name: exercise.name,
        description: exercise.description || '',
        category: exercise.category,
        muscleGroups: exercise.muscleGroups,
        equipment: exercise.equipment,
        difficulty: exercise.difficulty,
        instructions:
          exercise.instructions.length > 0 ? exercise.instructions : [''],
        tips: exercise.tips || '',
        videoUrl: exercise.videoUrl || '',
        imageUrl: exercise.imageUrl || '',
      });
    }
  }, [exercise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const exerciseData: any = {
        ...formData,
        instructions: formData.instructions.filter(
          (instruction) => instruction.trim() !== ''
        ),
        tags: exercise?.isSystem ? ['system'] : [], // Preserve system tag for existing system exercises
      };

      if (exercise) {
        exerciseData.id = exercise.id;
      }

      await onSave(exerciseData);
      onClose();
    } catch (error) {
      console.error('Failed to save exercise:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMuscleGroup = () => {
    const group = newMuscleGroup.trim().toLowerCase();
    if (group && !formData.muscleGroups.includes(group)) {
      setFormData((prev) => ({
        ...prev,
        muscleGroups: [...prev.muscleGroups, group],
      }));
      setNewMuscleGroup('');
    }
  };

  const removeMuscleGroup = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      muscleGroups: prev.muscleGroups.filter((_, i) => i !== index),
    }));
  };

  const addEquipment = () => {
    const eq = newEquipment.trim().toLowerCase();
    if (eq && !formData.equipment.includes(eq)) {
      setFormData((prev) => ({
        ...prev,
        equipment: [...prev.equipment, eq],
      }));
      setNewEquipment('');
    }
  };

  const removeEquipment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index),
    }));
  };

  const addInstruction = () => {
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ''],
    }));
  };

  const removeInstruction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) =>
        i === index ? value : inst
      ),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {exercise ? 'Edit Exercise' : 'Create New Exercise'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    difficulty: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Muscle Groups */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Muscle Groups
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.muscleGroups.map((group, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  >
                    {group}
                    <button
                      type="button"
                      onClick={() => removeMuscleGroup(index)}
                      className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={newMuscleGroup}
                  onChange={(e) => setNewMuscleGroup(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select muscle group...</option>
                  {muscleGroupOptions
                    .filter((option) => !formData.muscleGroups.includes(option))
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addMuscleGroup}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Equipment
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.equipment.map((eq, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    {eq}
                    <button
                      type="button"
                      onClick={() => removeEquipment(index)}
                      className="ml-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select equipment...</option>
                  {equipmentOptions
                    .filter((option) => !formData.equipment.includes(option))
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addEquipment}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructions
              </label>
              <div className="space-y-2">
                {formData.instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-8 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => updateInstruction(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter instruction step..."
                    />
                    {formData.instructions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstruction(index)}
                        className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addInstruction}
                className="mt-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Step</span>
              </button>
            </div>

            {/* Tips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tips (Optional)
              </label>
              <textarea
                value={formData.tips}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tips: e.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any helpful tips for performing this exercise..."
              />
            </div>

            {/* Media URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      videoUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Saving...'
                  : exercise
                    ? 'Update Exercise'
                    : 'Create Exercise'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
