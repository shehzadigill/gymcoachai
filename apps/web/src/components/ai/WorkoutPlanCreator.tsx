'use client';

import { useState, useEffect } from 'react';
import {
  Dumbbell,
  Check,
  X,
  Calendar,
  Target,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  Brain,
  ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService } from '../../lib/ai-service-client';

// Helper function to process and clean content
function processContent(content: string): string {
  return content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Reasoning Section Component with animations
function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 text-xs text-gray-600 dark:text-gray-400 group"
        aria-label={isExpanded ? 'Hide reasoning' : 'Show reasoning'}
      >
        <span className="font-medium flex items-center gap-2">
          <Brain className="h-3 w-3" />
          Reasoning
        </span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed"
          style={{
            filter: 'blur(0.3px)',
            WebkitFilter: 'blur(0.3px)',
          }}
        >
          {processContent(reasoning)}
        </div>
      </div>
    </div>
  );
}

interface WorkoutPlanPreview {
  name: string;
  description: string;
  difficulty: string;
  duration_weeks: number;
  frequency_per_week: number;
  tags: string[];
  weeks?: Array<{
    week_number: number;
    focus: string;
    sessions: Array<{
      name: string;
      day: number;
      duration_minutes: number;
      exercises: Array<{
        name: string;
        sets: number;
        reps?: number;
        duration_seconds?: number;
        rest_seconds: number;
        found_in_db?: boolean;
        needs_creation?: boolean;
      }>;
    }>;
  }>;
  new_exercises_count?: number;
  total_exercises?: number;
}

interface WorkoutPlanCreationState {
  stage: 'input' | 'gathering' | 'preview' | 'saving' | 'complete';
  conversationId?: string;
  requirements?: any;
  plan?: WorkoutPlanPreview;
  message?: string;
  missingFields?: string[];
}

interface WorkoutPlanCreatorProps {
  onComplete?: (planId: string) => void;
  onCancel?: () => void;
}

export default function WorkoutPlanCreator({
  onComplete,
  onCancel,
}: WorkoutPlanCreatorProps) {
  const [state, setState] = useState<WorkoutPlanCreationState>({
    stage: 'input',
  });
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);

  const handleSubmitRequest = async () => {
    if (!userInput.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message to history
    setConversationHistory((prev) => [
      ...prev,
      { role: 'user', content: userInput },
    ]);

    try {
      const data = await aiService.createWorkoutPlan(
        userInput,
        state.conversationId
      );

      if (data.success) {
        // Add assistant response to history
        setConversationHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.data.message },
        ]);

        setState({
          stage:
            data.data.stage === 'awaiting_approval' ? 'preview' : 'gathering',
          conversationId: data.data.conversationId,
          requirements: data.data.requirements,
          plan: data.data.plan,
          message: data.data.message,
          missingFields: data.metadata?.missingFields,
        });

        setUserInput('');
      } else {
        throw new Error(data.error || 'Failed to process request');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!state.conversationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const approvalData = await aiService.approveWorkoutPlan(
        state.conversationId,
        'yes, save this plan'
      );

      if (approvalData.success) {
        setState({
          stage: 'complete',
          conversationId: state.conversationId,
          message: approvalData.data.message,
        });

        // Call onComplete callback after a short delay
        if (onComplete && approvalData.data.planId) {
          setTimeout(() => {
            onComplete(approvalData.data.planId);
          }, 2000);
        }
      } else {
        throw new Error(approvalData.error || 'Failed to approve plan');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModify = async (modificationRequest: string) => {
    if (!state.conversationId) return;

    setIsLoading(true);
    setError(null);

    setConversationHistory((prev) => [
      ...prev,
      { role: 'user', content: modificationRequest },
    ]);

    try {
      const response = await fetch('/api/ai/workout-plan/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: state.conversationId,
          message: modificationRequest,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process modification');
      }

      const data = await response.json();

      if (data.success) {
        setConversationHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.data.message },
        ]);

        setState({
          stage: 'gathering',
          conversationId: state.conversationId,
          message: data.data.message,
        });
      } else {
        throw new Error(data.error || 'Failed to process modification');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderInitialPrompt = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-2">
          <Dumbbell className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Your Personalized Workout Plan
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          Let's build a workout plan tailored to your goals. Tell me what you're
          looking to achieve!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <button
          onClick={() =>
            setUserInput(
              'I want to build muscle mass with 4 workouts per week for 12 weeks'
            )
          }
          className="p-4 text-left border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
        >
          <Target className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
          <div className="font-semibold text-gray-900 dark:text-white mb-1">
            Build Muscle
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            4 days/week, 12 weeks
          </div>
        </button>

        <button
          onClick={() =>
            setUserInput(
              'I want to lose weight with 5 days of cardio and strength training for 8 weeks'
            )
          }
          className="p-4 text-left border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
        >
          <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
          <div className="font-semibold text-gray-900 dark:text-white mb-1">
            Lose Weight
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            5 days/week, 8 weeks
          </div>
        </button>

        <button
          onClick={() =>
            setUserInput(
              'I want to improve overall fitness with 3 full-body workouts per week for 6 weeks'
            )
          }
          className="p-4 text-left border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
        >
          <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
          <div className="font-semibold text-gray-900 dark:text-white mb-1">
            General Fitness
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            3 days/week, 6 weeks
          </div>
        </button>
      </div>
    </div>
  );

  const renderConversation = () => (
    <div className="space-y-6">
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {conversationHistory.map((msg, idx) => {
          // Extract reasoning from message content
          const reasoningMatch = msg.content.match(
            /<reasoning>([\s\S]*?)<\/reasoning>/
          );
          const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
          let mainContent = msg.content
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
            .trim();
          // Process HTML entities and special characters
          mainContent = processContent(mainContent);

          return (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {/* Reasoning Section (Collapsible, Blurred, Small Text) */}
                    {reasoning && <ReasoningSection reasoning={reasoning} />}

                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="mb-1">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-900 dark:text-white">
                            {children}
                          </strong>
                        ),
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 italic my-2">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full border border-gray-300 dark:border-gray-600">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gray-100 dark:bg-gray-700">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="bg-white dark:bg-gray-800">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children }) => (
                          <tr className="border-b border-gray-200 dark:border-gray-600">
                            {children}
                          </tr>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                            {children}
                          </td>
                        ),
                        th: ({ children }) => (
                          <th className="px-3 py-2 text-gray-900 dark:text-gray-100 font-semibold border-r border-gray-300 dark:border-gray-600 last:border-r-0 text-left">
                            {children}
                          </th>
                        ),
                      }}
                    >
                      {mainContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state.missingFields && state.missingFields.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Still need some information
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {state.missingFields.join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPlanPreview = () => {
    if (!state.plan) return null;

    return (
      <div className="space-y-6">
        {/* Plan Header */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">{state.plan.name}</h3>
              <p className="text-blue-100">{state.plan.description}</p>
            </div>
            <CheckCircle className="h-8 w-8 flex-shrink-0 ml-4" />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <div className="text-2xl font-bold">
                {state.plan.duration_weeks} weeks
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Frequency</span>
              </div>
              <div className="text-2xl font-bold">
                {state.plan.frequency_per_week} days/week
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Level</span>
              </div>
              <div className="text-2xl font-bold capitalize">
                {state.plan.difficulty}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {(() => {
            // Extract reasoning from message content
            const reasoningMatch = state.message?.match(
              /<reasoning>([\s\S]*?)<\/reasoning>/
            );
            const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
            let mainContent = (state.message || '')
              .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
              .trim();
            // Process HTML entities and special characters
            mainContent = processContent(mainContent);

            return (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {/* Reasoning Section (Collapsible, Blurred, Small Text) */}
                {reasoning && <ReasoningSection reasoning={reasoning} />}

                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900 dark:text-white">
                        {children}
                      </strong>
                    ),
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 italic my-2">
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold mb-3 mt-4 text-gray-900 dark:text-white">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-bold mb-2 mt-3 text-gray-900 dark:text-white">
                        {children}
                      </h3>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2">
                        <table className="min-w-full border border-gray-300 dark:border-gray-600">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        {children}
                      </thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="bg-white dark:bg-gray-800">
                        {children}
                      </tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        {children}
                      </tr>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                        {children}
                      </td>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-gray-900 dark:text-gray-100 font-semibold border-r border-gray-300 dark:border-gray-600 last:border-r-0 text-left">
                        {children}
                      </th>
                    ),
                  }}
                >
                  {mainContent}
                </ReactMarkdown>
              </div>
            );
          })()}
        </div>

        {/* Exercise Summary */}
        {state.plan.new_exercises_count &&
          state.plan.new_exercises_count > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-green-900 dark:text-green-100 mb-1">
                    New Exercises
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    {state.plan.new_exercises_count} new exercises will be
                    created specifically for your plan
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Saving Plan...</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                <span>Save This Plan</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              const modification = prompt(
                'What would you like to change about this plan?'
              );
              if (modification) {
                handleModify(modification);
              }
            }}
            disabled={isLoading}
            className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Modify
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="p-3 border-2 border-gray-300 dark:border-gray-600 hover:border-red-500 dark:hover:border-red-500 text-gray-700 dark:text-gray-300 rounded-xl transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderComplete = () => {
    // Extract reasoning from message content
    const reasoningMatch = state.message?.match(
      /<reasoning>([\s\S]*?)<\/reasoning>/
    );
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
    let mainContent = (state.message || 'Your workout plan has been saved.')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
      .trim();
    // Process HTML entities and special characters
    mainContent = processContent(mainContent);

    return (
      <div className="text-center space-y-6 py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Plan Created Successfully!
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
            {/* Reasoning Section (Collapsible, Blurred, Small Text) */}
            {reasoning && <ReasoningSection reasoning={reasoning} />}

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900 dark:text-white">
                    {children}
                  </strong>
                ),
              }}
            >
              {mainContent}
            </ReactMarkdown>
          </div>
        </div>

        <button
          onClick={() => (window.location.href = '/workouts')}
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          <span>View My Workouts</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-red-900 dark:text-red-100">
                Error
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        {state.stage === 'input' && renderInitialPrompt()}
        {state.stage === 'gathering' && renderConversation()}
        {state.stage === 'preview' && renderPlanPreview()}
        {state.stage === 'complete' && renderComplete()}

        {/* Input Section (except on complete stage) */}
        {state.stage !== 'complete' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitRequest();
                    }
                  }}
                  placeholder={
                    state.stage === 'input'
                      ? 'Describe your fitness goals, or choose a quick start option above...'
                      : 'Type your response...'
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <button
                onClick={handleSubmitRequest}
                disabled={!userInput.trim() || isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
