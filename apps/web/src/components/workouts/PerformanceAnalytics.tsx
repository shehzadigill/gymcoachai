'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Target,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { TrendChart, ConfidenceIndicator } from '../ai/visualizations';
import type {
  PerformanceAnalysis,
  PerformancePrediction,
} from '../../types/ai-service';

interface PerformanceAnalyticsProps {
  userId: string;
  timeRange?: number; // days
  className?: string;
}

export default function PerformanceAnalytics({
  userId,
  timeRange = 30,
  className = '',
}: PerformanceAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(
    null
  );
  const [selectedMetric, setSelectedMetric] = useState<string>('strength');

  useEffect(() => {
    fetchPerformanceData();
  }, [userId, timeRange]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get recent workout data
      const recentWorkouts = await aiService.getRecentWorkouts(timeRange);

      // Analyze performance
      const analysisResponse = await aiService.analyzePerformance({
        workoutData: recentWorkouts,
        timeRange: timeRange,
        metrics: ['strength', 'endurance', 'volume', 'consistency'],
      });

      // Get performance prediction
      const predictionResponse = await aiService.predictPerformance({
        userId: userId,
        timeRange: timeRange,
        metrics: ['strength', 'endurance', 'volume'],
      });

      setAnalysis(analysisResponse);
      setPrediction(predictionResponse);
    } catch (err: any) {
      console.error('Failed to fetch performance data:', err);
      setError(err.message || 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatMetricValue = (value: number, metric: string) => {
    switch (metric) {
      case 'strength':
        return `${value.toFixed(1)} lbs`;
      case 'endurance':
        return `${value.toFixed(0)} min`;
      case 'volume':
        return `${value.toFixed(0)} sets`;
      case 'consistency':
        return `${(value * 100).toFixed(0)}%`;
      default:
        return value.toFixed(1);
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPerformanceData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Performance Analytics
          </h3>
        </div>
        <ConfidenceIndicator score={analysis.confidence} />
      </div>

      {/* Metric Selector */}
      <div className="flex space-x-2 mb-6">
        {analysis.trends.map((trend) => (
          <button
            key={trend.metric}
            onClick={() => setSelectedMetric(trend.metric)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedMetric === trend.metric
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {trend.metric.charAt(0).toUpperCase() + trend.metric.slice(1)}
          </button>
        ))}
      </div>

      {/* Selected Metric Chart */}
      {analysis.trends.find((trend) => trend.metric === selectedMetric) && (
        <div className="mb-6">
          <TrendChart
            data={
              analysis.trends.find((trend) => trend.metric === selectedMetric)
                ?.dataPoints || []
            }
            title={`${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Trend`}
            yAxisLabel={selectedMetric}
            height={200}
          />
        </div>
      )}

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {analysis.trends.map((trend, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                {trend.metric.charAt(0).toUpperCase() + trend.metric.slice(1)}
              </h4>
              {getTrendIcon(trend.direction)}
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatMetricValue(trend.currentValue, trend.metric)}
            </div>
            <div className={`text-sm ${getTrendColor(trend.direction)}`}>
              {trend.changePercentage > 0 ? '+' : ''}
              {trend.changePercentage.toFixed(1)}% vs last period
            </div>
          </div>
        ))}
      </div>

      {/* Anomalies */}
      {analysis.anomalies.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Performance Anomalies
          </h4>
          <div className="space-y-2">
            {analysis.anomalies.map((anomaly, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-yellow-800">
                    {anomaly.type}
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">
                    {anomaly.description}
                  </div>
                  {anomaly.recommendation && (
                    <div className="text-sm text-yellow-600 mt-1">
                      <strong>Recommendation:</strong> {anomaly.recommendation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {prediction && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Performance Predictions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prediction.predictions.map((pred, index) => (
              <div key={index} className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  {pred.metric.charAt(0).toUpperCase() + pred.metric.slice(1)}
                </div>
                <div className="text-lg font-bold text-blue-800 mb-1">
                  {formatMetricValue(pred.predictedValue, pred.metric)}
                </div>
                <div className="text-xs text-blue-600">
                  In {pred.timeframe} days
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Confidence: {(pred.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            AI Recommendations
          </h4>
          <div className="space-y-2">
            {analysis.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <Target className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-green-800">
                    {recommendation.title}
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    {recommendation.description}
                  </div>
                  {recommendation.priority && (
                    <div className="text-xs text-green-600 mt-1">
                      Priority: {recommendation.priority}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
