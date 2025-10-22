'use client';

import { useState } from 'react';
import { api } from '../../../../lib/api-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Apple,
  Calendar,
  Target,
  CheckCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface MealPlanData {
  goals: string[];
  dietaryRestrictions: string[];
  duration: number;
}

const GOAL_OPTIONS = [
  'Weight Loss',
  'Weight Gain',
  'Muscle Building',
  'Maintenance',
  'Athletic Performance',
  'General Health',
  'Energy Boost',
  'Digestive Health',
];

const DIETARY_RESTRICTIONS = [
  'None',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Low-Carb',
  'Keto',
  'Paleo',
  'Mediterranean',
  'Low-Sodium',
  'Diabetic-Friendly',
];

export default function MealPlanGenerator() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<MealPlanData>({
    goals: [],
    dietaryRestrictions: [],
    duration: 7,
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

  const handleRestrictionToggle = (restriction: string) => {
    setFormData((prev) => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter((r) => r !== restriction)
        : [...prev.dietaryRestrictions, restriction],
    }));
  };

  const handleNext = () => {
    if (step === 1 && formData.goals.length === 0) {
      setError('Please select at least one goal');
      return;
    }
    if (step === 2 && formData.dietaryRestrictions.length === 0) {
      setError('Please select at least one dietary preference');
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
      const response = await api.generateMealPlan(formData);
      setGeneratedPlan(
        response.plan || response.reply || 'Meal plan generated successfully!'
      );
      setStep(4);
    } catch (err) {
      setError('Failed to generate meal plan. Please try again.');
      console.error('Error generating meal plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      goals: [],
      dietaryRestrictions: [],
      duration: 7,
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
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              AI Meal Plan Generator
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Create a personalized meal plan tailored to your dietary needs
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
                    ? 'bg-green-600 text-white'
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
                      ? 'bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Goals</span>
          <span>Dietary Needs</span>
          <span>Duration</span>
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
              What are your nutrition goals?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Select all that apply to help create the most effective meal plan
              for you.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {GOAL_OPTIONS.map((goal) => (
                <button
                  key={goal}
                  onClick={() => handleGoalToggle(goal)}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    formData.goals.includes(goal)
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
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
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Dietary Restrictions */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Any dietary restrictions or preferences?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Select all that apply to customize your meal plan accordingly.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <button
                  key={restriction}
                  onClick={() => handleRestrictionToggle(restriction)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    formData.dietaryRestrictions.includes(restriction)
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Apple className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{restriction}</div>
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
              disabled={formData.dietaryRestrictions.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Duration */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              How long would you like the meal plan?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Choose the duration for your personalized meal plan.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Duration
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 3, label: '3 Days' },
                    { value: 7, label: '1 Week' },
                    { value: 14, label: '2 Weeks' },
                    { value: 30, label: '1 Month' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          duration: option.value,
                        }))
                      }
                      className={`p-4 rounded-lg border-2 text-center transition-colors ${
                        formData.duration === option.value
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Calendar className="h-6 w-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">{option.label}</div>
                    </button>
                  ))}
                </div>
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
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
              Your Personalized Meal Plan
            </h2>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-2 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 last:mb-0">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-sm">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded overflow-x-auto">
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic">
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold mb-4">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-semibold mb-3">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-medium mb-2">{children}</h3>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-left">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {generatedPlan}
                </ReactMarkdown>
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
