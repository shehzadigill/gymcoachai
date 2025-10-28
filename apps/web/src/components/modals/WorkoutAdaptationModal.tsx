'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Dumbbell,
  Clock,
  Target,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { ConfidenceIndicator, ComparisonView } from '../ai/visualizations';
import { formatAdaptationReasoning } from '../../lib/ai-utils';
import PerformanceAnalytics from '../workouts/PerformanceAnalytics';
import type {
  WorkoutAdaptation,
  Adaptation,
  RiskAssessment,
} from '../../types/ai-service';

// Extended types for this component
interface ExtendedAdaptation extends Adaptation {
  id: string;
  title: string;
  description: string;
  changes?: string[];
}

interface ExtendedRiskAssessment extends RiskAssessment {
  riskFactors: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  preventionTips: string[];
}

interface ExtendedPerformanceAnalysis {
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    description: string;
    changePercentage: number;
  }>;
  anomalies: Array<{
    type: string;
    description: string;
  }>;
  confidence: number;
}

interface WorkoutAdaptationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: {
    id: string;
    name: string;
    exercises: Array<{
      exerciseId: string;
      name: string;
      sets: number;
      reps?: number;
      durationSeconds?: number;
      weight?: number;
      restSeconds?: number;
      notes?: string;
      order: number;
    }>;
  };
  onApplyAdaptations?: (adaptations: Adaptation[]) => void;
}

export default function WorkoutAdaptationModal({
  isOpen,
  onClose,
  currentPlan,
  onApplyAdaptations,
}: WorkoutAdaptationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaptations, setAdaptations] = useState<{
    adaptations: ExtendedAdaptation[];
    confidence: number;
  } | null>(null);
  const [injuryRisk, setInjuryRisk] = useState<ExtendedRiskAssessment | null>(
    null
  );
  const [performanceAnalysis, setPerformanceAnalysis] =
    useState<ExtendedPerformanceAnalysis | null>(null);
  const [selectedAdaptations, setSelectedAdaptations] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<
    'adaptations' | 'injury' | 'performance'
  >('adaptations');

  useEffect(() => {
    if (isOpen && currentPlan) {
      analyzeWorkout();
    }
  }, [isOpen, currentPlan]);

  const analyzeWorkout = async () => {
    try {
      setLoading(true);
      setError(null);

      // Analyze workout plan adaptations
      const adaptationResponse = await aiService.adaptWorkoutPlan({
        workoutPlanId: currentPlan.id,
        userFeedback: 'Analyze current workout plan for optimizations',
      });

      // Assess injury risk
      const injuryResponse = await aiService.assessInjuryRisk();

      // Analyze performance trends
      const performanceResponse = await aiService.analyzePerformance();

      // Transform adaptations to match extended type
      const transformedAdaptations = adaptationResponse.data.adaptations.map(
        (adaptation, index) => ({
          ...adaptation,
          id: `adaptation-${index}`,
          title: `${adaptation.type.charAt(0).toUpperCase() + adaptation.type.slice(1)} Adjustment`,
          description: adaptation.reasoning,
          changes: [
            `Change ${adaptation.type} from ${adaptation.currentValue} to ${adaptation.recommendedValue}`,
          ],
        })
      );

      setAdaptations({
        adaptations: transformedAdaptations,
        confidence: adaptationResponse.data.confidence,
      });

      setInjuryRisk({
        overallRisk: injuryResponse.data.risk as 'low' | 'medium' | 'high',
        factors: injuryResponse.data.factors.map((f: any) => ({
          factor: f.name || f.factor,
          risk: f.severity || f.risk || 'medium',
          description: f.description,
          mitigation: f.recommendation || f.mitigation || '',
        })),
        recommendations: injuryResponse.data.recommendations,
        confidence: 0.8,
        riskFactors: injuryResponse.data.factors.map((f: any) => ({
          description: f.description || f.factor,
          severity: f.severity || f.risk || 'medium',
        })),
        preventionTips: injuryResponse.data.recommendations,
      });

      setPerformanceAnalysis({
        trends: (performanceResponse.data.trends || []).map((trend: any) => ({
          metric: trend.metric || 'Performance',
          direction: trend.direction || 'stable',
          description: trend.description || 'Performance trend analysis',
          changePercentage: trend.change || 0,
        })),
        anomalies: (performanceResponse.data.analysis?.anomalies || []).map(
          (anomaly: any) => ({
            type: anomaly.type || 'Performance Issue',
            description: anomaly.description || 'Detected performance anomaly',
          })
        ),
        confidence: 0.8,
      });
    } catch (err: any) {
      console.error('Failed to analyze workout:', err);
      setError(err.message || 'Failed to analyze workout');
    } finally {
      setLoading(false);
    }
  };
  const handleAdaptationToggle = (adaptationId: string) => {
    const newSelected = new Set(selectedAdaptations);
    if (newSelected.has(adaptationId)) {
      newSelected.delete(adaptationId);
    } else {
      newSelected.add(adaptationId);
    }
    setSelectedAdaptations(newSelected);
  };

  const handleApplyAdaptations = () => {
    if (!adaptations) return;

    const selectedAdaptationObjects = adaptations.adaptations.filter(
      (adaptation) => selectedAdaptations.has(adaptation.id)
    );

    if (onApplyAdaptations) {
      onApplyAdaptations(selectedAdaptationObjects);
    }
    onClose();
  };

  const getAdaptationIcon = (type: string) => {
    switch (type) {
      case 'intensity':
        return <TrendingUp className="w-4 h-4" />;
      case 'volume':
        return <Dumbbell className="w-4 h-4" />;
      case 'rest':
        return <Clock className="w-4 h-4" />;
      case 'exercise':
        return <Target className="w-4 h-4" />;
      default:
        return <Dumbbell className="w-4 h-4" />;
    }
  };

  const getAdaptationColor = (type: string) => {
    switch (type) {
      case 'intensity':
        return 'text-orange-600 bg-orange-100';
      case 'volume':
        return 'text-blue-600 bg-blue-100';
      case 'rest':
        return 'text-green-600 bg-green-100';
      case 'exercise':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              AI Workout Analysis
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Analyzing "{currentPlan.name}" for optimizations
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('adaptations')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'adaptations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Adaptations
          </button>
          <button
            onClick={() => setActiveTab('injury')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'injury'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Injury Risk
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'performance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Performance
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">
                Analyzing your workout...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={analyzeWorkout}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Adaptations Tab */}
              {activeTab === 'adaptations' && adaptations && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Recommended Adaptations
                    </h3>
                    <ConfidenceIndicator score={adaptations.confidence} />
                  </div>

                  <div className="space-y-4">
                    {adaptations.adaptations.map((adaptation) => (
                      <div
                        key={adaptation.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          selectedAdaptations.has(adaptation.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedAdaptations.has(adaptation.id)}
                              onChange={() =>
                                handleAdaptationToggle(adaptation.id)
                              }
                              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAdaptationColor(
                                    adaptation.type
                                  )}`}
                                >
                                  {getAdaptationIcon(adaptation.type)}
                                  <span className="ml-1 capitalize">
                                    {adaptation.type}
                                  </span>
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {adaptation.title}
                                </span>
                              </div>

                              <p className="text-sm text-gray-600 mb-3">
                                {adaptation.description}
                              </p>

                              <div className="space-y-2">
                                <div className="text-sm">
                                  <span className="font-medium text-gray-700">
                                    Reasoning:
                                  </span>
                                  <div className="mt-1 text-gray-600 whitespace-pre-line">
                                    {formatAdaptationReasoning(
                                      adaptation.reasoning
                                    )}
                                  </div>
                                </div>

                                {adaptation.changes && (
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">
                                      Changes:
                                    </span>
                                    <ul className="mt-1 list-disc list-inside text-gray-600">
                                      {adaptation.changes.map(
                                        (change: string, index: number) => (
                                          <li key={index}>{change}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Injury Risk Tab */}
              {activeTab === 'injury' && injuryRisk && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Injury Risk Assessment
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          injuryRisk.overallRisk === 'low'
                            ? 'bg-green-100 text-green-800'
                            : injuryRisk.overallRisk === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {injuryRisk.overallRisk.toUpperCase()} RISK
                      </span>
                      <ConfidenceIndicator score={injuryRisk.confidence} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">
                        Risk Factors
                      </h4>
                      <div className="space-y-2">
                        {injuryRisk.riskFactors.map(
                          (
                            factor: { description: string; severity: string },
                            index: number
                          ) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm text-gray-700">
                                {factor.description}
                              </span>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  factor.severity === 'low'
                                    ? 'bg-green-100 text-green-800'
                                    : factor.severity === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {factor.severity}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">
                        Prevention Recommendations
                      </h4>
                      <div className="space-y-2">
                        {injuryRisk.preventionTips.map(
                          (tip: string, index: number) => (
                            <div
                              key={index}
                              className="p-3 bg-blue-50 rounded-lg"
                            >
                              <p className="text-sm text-gray-700">{tip}</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && performanceAnalysis && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Performance Analysis
                    </h3>
                    <ConfidenceIndicator
                      score={performanceAnalysis.confidence}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {performanceAnalysis.trends.map(
                      (trend: any, index: number) => (
                        <div
                          key={index}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">
                              {trend.metric}
                            </h4>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                trend.direction === 'up'
                                  ? 'bg-green-100 text-green-800'
                                  : trend.direction === 'down'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {trend.direction}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {trend.description}
                          </p>
                          <div className="text-xs text-gray-500">
                            Change: {trend.changePercentage > 0 ? '+' : ''}
                            {trend.changePercentage.toFixed(1)}%
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {performanceAnalysis.anomalies.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">
                        Performance Anomalies
                      </h4>
                      <div className="space-y-2">
                        {performanceAnalysis.anomalies.map(
                          (anomaly: any, index: number) => (
                            <div
                              key={index}
                              className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                            >
                              <div className="flex items-center space-x-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800">
                                  {anomaly.type}
                                </span>
                              </div>
                              <p className="text-sm text-yellow-700">
                                {anomaly.description}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {selectedAdaptations.size > 0 && (
                <span>
                  {selectedAdaptations.size} adaptation
                  {selectedAdaptations.size !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {activeTab === 'adaptations' && (
                <button
                  onClick={handleApplyAdaptations}
                  disabled={selectedAdaptations.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Apply Selected Adaptations</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
