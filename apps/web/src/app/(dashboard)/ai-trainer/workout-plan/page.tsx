'use client';

import { useState } from 'react';
import { api } from '../../../../lib/api-client';
import {
  Bot,
  Dumbbell,
  Calendar,
  Target,
  CheckCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface WorkoutPlanData {
  goals: string[];
  duration: number;
  daysPerWeek: number;
  equipment: string[];
}

const GOAL_OPTIONS = [
  'Build Muscle',
  'Lose Weight',
  'Get Stronger',
  'Improve Endurance',
  'Tone Body',
  'Increase Flexibility',
  'Sports Performance',
  'General Fitness',
];

const EQUIPMENT_OPTIONS = [
  'Bodyweight Only',
  'Dumbbells',
  'Barbell',
  'Kettlebells',
  'Resistance Bands',
  'Pull-up Bar',
  'Gym Machines',
  'Cardio Equipment',
  'Yoga Mat',
  'Medicine Ball',
];

export default function WorkoutPlanGenerator() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WorkoutPlanData>({
    goals: [],
    duration: 4,
    daysPerWeek: 3,
    equipment: [],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoalToggle = (goal: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  const handleEquipmentToggle = (equipment: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment.filter((e) => e !== equipment)
        : [...prev.equipment, equipment],
    }));
  };

  const handleNext = () => {
    if (step === 1 && formData.goals.length === 0) {
      setError('Please select at least one goal');
      return;
    }
    if (step === 2 && formData.equipment.length === 0) {
      setError('Please select at least one equipment option');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.generateWorkoutPlan(formData);
      setGeneratedPlan(
        response.plan ||
          response.reply ||
          'Workout plan generated successfully!'
      );
      setStep(4);
    } catch (err) {
      setError('Failed to generate workout plan. Please try again.');
      console.error('Error generating workout plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      goals: [],
      duration: 4,
      daysPerWeek: 3,
      equipment: [],
    });
    setGeneratedPlan(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link
          href="/ai-trainer"
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              AI Workout Plan Generator
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Create a personalized workout plan tailored to your goals
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {step > stepNumber ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  stepNumber
                )}
              </div>
              {stepNumber < 4 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step > stepNumber
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Goals</span>
          <span>Equipment</span>
          <span>Preferences</span>
          <span>Generate</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Step 1: Goals */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              What are your fitness goals?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Select all that apply to help create the most effective plan for
              you.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {GOAL_OPTIONS.map((goal) => (
                <button
                  key={goal}
                  onClick={() => handleGoalToggle(goal)}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    formData.goals.includes(goal)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Target className="h-6 w-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">{goal}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={formData.goals.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Equipment */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              What equipment do you have access to?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Select all available equipment to customize your workout plan.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {EQUIPMENT_OPTIONS.map((equipment) => (
                <button
                  key={equipment}
                  onClick={() => handleEquipmentToggle(equipment)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    formData.equipment.includes(equipment)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Dumbbell className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{equipment}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={formData.equipment.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preferences */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Set your preferences
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Customize the duration and frequency of your workout plan.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Duration (weeks)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value={2}>2 weeks</option>
                  <option value={4}>4 weeks</option>
                  <option value={6}>6 weeks</option>
                  <option value={8}>8 weeks</option>
                  <option value={12}>12 weeks</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workout Days Per Week
                </label>
                <select
                  value={formData.daysPerWeek}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      daysPerWeek: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={4}>4 days</option>
                  <option value={5}>5 days</option>
                  <option value={6}>6 days</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  <span>Generate Plan</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Generated Plan */}
      {step === 4 && generatedPlan && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Your Personalized Workout Plan
            </h2>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {generatedPlan}
                </pre>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={resetForm}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Create Another Plan
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save/Print Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
