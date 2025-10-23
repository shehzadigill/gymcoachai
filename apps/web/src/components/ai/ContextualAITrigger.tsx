'use client';

import React, { useState } from 'react';
import { Bot, MessageCircle, ArrowRight, X, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ContextualAITriggerProps {
  context: {
    type:
      | 'workout'
      | 'exercise'
      | 'nutrition'
      | 'progress'
      | 'analytics'
      | 'general';
    data?: any;
    title: string;
    description: string;
    suggestedQuestions?: string[];
  };
  className?: string;
}

const contextualQuestions = {
  workout: [
    'How can I improve this workout?',
    'What exercises should I add?',
    'Is this workout safe for my goals?',
    'How should I progress this workout?',
  ],
  exercise: [
    "What's the proper form for this exercise?",
    'What muscles does this target?',
    'How can I make this harder?',
    'What are good alternatives?',
  ],
  nutrition: [
    'How do these macros look?',
    'What should I eat before/after?',
    'How can I improve my nutrition?',
    'Are there better food choices?',
  ],
  progress: [
    'How is my progress looking?',
    'What should I focus on next?',
    'Am I on track for my goals?',
    'What changes should I make?',
  ],
  analytics: [
    'What does this data mean?',
    'How can I improve these metrics?',
    'What trends do you see?',
    'What should I focus on?',
  ],
  general: [
    'What do you think about this?',
    'How can I improve?',
    'What would you recommend?',
    'Any advice for me?',
  ],
};

export default function ContextualAITrigger({
  context,
  className = '',
}: ContextualAITriggerProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState('');

  const questions =
    context.suggestedQuestions ||
    contextualQuestions[context.type] ||
    contextualQuestions.general;

  const handleQuestionSelect = (question: string) => {
    setSelectedQuestion(question);
    setShowSuggestions(false);
  };

  const buildAIChatURL = (question: string) => {
    const params = new URLSearchParams({
      context: context.type,
      question: question,
      ...(context.data && { data: JSON.stringify(context.data) }),
    });
    return `/ai-trainer?${params.toString()}`;
  };

  const getContextIcon = (type: string) => {
    const icons = {
      workout: '💪',
      exercise: '🏋️',
      nutrition: '🍎',
      progress: '📈',
      analytics: '📊',
      general: '🤖',
    };
    return icons[type as keyof typeof icons] || '🤖';
  };

  const getContextColor = (type: string) => {
    const colors = {
      workout: 'from-blue-50 to-indigo-50 border-blue-200',
      exercise: 'from-green-50 to-emerald-50 border-green-200',
      nutrition: 'from-orange-50 to-amber-50 border-orange-200',
      progress: 'from-purple-50 to-violet-50 border-purple-200',
      analytics: 'from-pink-50 to-rose-50 border-pink-200',
      general: 'from-gray-50 to-slate-50 border-gray-200',
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Trigger Button */}
      <div
        className={`bg-gradient-to-r ${getContextColor(context.type)} rounded-lg border p-4 transition-all hover:shadow-md`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getContextIcon(context.type)}</div>
            <div>
              <h4 className="font-medium text-gray-900">{context.title}</h4>
              <p className="text-sm text-gray-600">{context.description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>

            <Link
              href={buildAIChatURL(questions[0])}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
            >
              <Bot className="w-4 h-4" />
              <span>Ask AI</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Suggested Questions */}
        {showSuggestions && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                Suggested Questions:
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {questions.map((question, index) => (
                <Link
                  key={index}
                  href={buildAIChatURL(question)}
                  className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 group-hover:text-blue-700">
                      {question}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for easy integration
export function useContextualAI(context: ContextualAITriggerProps['context']) {
  const [isVisible, setIsVisible] = useState(true);

  const dismiss = () => setIsVisible(false);
  const show = () => setIsVisible(true);

  return {
    isVisible,
    dismiss,
    show,
    ContextualAITrigger: isVisible ? (
      <ContextualAITrigger context={context} />
    ) : null,
  };
}
