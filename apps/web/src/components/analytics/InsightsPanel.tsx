'use client';

import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Target,
  Trophy,
} from 'lucide-react';
import { WorkoutInsights } from '../../types/analytics';

interface InsightsPanelProps {
  insights: WorkoutInsights;
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const getRiskColor = (risk: number) => {
    if (risk < 0.3) return 'text-green-600 bg-green-50 border-green-200';
    if (risk < 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getRiskIcon = (risk: number) => {
    if (risk < 0.3) return <CheckCircle className="h-5 w-5" />;
    if (risk < 0.7) return <AlertTriangle className="h-5 w-5" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  const getTrendColor = (trend: string | undefined | null) => {
    if (!trend) return 'text-gray-600';

    switch (trend.toLowerCase()) {
      case 'improving':
      case 'good':
      case 'increasing':
        return 'text-green-600';
      case 'declining':
      case 'poor':
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Trends */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Performance Trends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Strength</div>
            <div
              className={`text-lg font-semibold ${getTrendColor(insights.strength_trend)}`}
            >
              {insights.strength_trend || 'No data'}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Consistency</div>
            <div
              className={`text-lg font-semibold ${getTrendColor(insights.consistency_trend)}`}
            >
              {insights.consistency_trend || 'No data'}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Volume</div>
            <div
              className={`text-lg font-semibold ${getTrendColor(insights.volume_trend)}`}
            >
              {insights.volume_trend || 'No data'}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Risk Assessment
        </h3>
        <div className="space-y-3">
          <div
            className={`flex items-center p-3 rounded-lg border ${getRiskColor(insights.plateau_risk || 0)}`}
          >
            {getRiskIcon(insights.plateau_risk || 0)}
            <div className="ml-3">
              <div className="font-medium">Plateau Risk</div>
              <div className="text-sm opacity-75">
                {((insights.plateau_risk || 0) * 100).toFixed(0)}% probability
                of hitting a plateau
              </div>
            </div>
          </div>
          <div
            className={`flex items-center p-3 rounded-lg border ${getRiskColor(insights.overtraining_risk || 0)}`}
          >
            {getRiskIcon(insights.overtraining_risk || 0)}
            <div className="ml-3">
              <div className="font-medium">Overtraining Risk</div>
              <div className="text-sm opacity-75">
                {((insights.overtraining_risk || 0) * 100).toFixed(0)}% risk of
                overtraining
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {(insights.recommendations || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {(insights.recommendations || []).map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {(insights.warnings || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-orange-500" />
            Warnings
          </h3>
          <ul className="space-y-2">
            {(insights.warnings || []).map((warning, index) => (
              <li key={index} className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Achievements */}
      {(insights.achievements_unlocked || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
            Recent Achievements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(insights.achievements_unlocked || []).map(
              (achievement, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <span className="text-gray-700 font-medium">
                    {achievement}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Next Milestones */}
      {(insights.next_milestones || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2 text-blue-500" />
            Next Milestones
          </h3>
          <div className="space-y-3">
            {(insights.next_milestones || []).map((milestone, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
              >
                <Target className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <span className="text-gray-700">{milestone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strength Predictions */}
      {(insights.strength_predictions || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Strength Predictions
          </h3>
          <div className="space-y-3">
            {(insights.strength_predictions || []).map((prediction, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {prediction.exercise_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    in {prediction.timeframe}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-blue-600">
                    {prediction.predicted_max} lbs
                  </div>
                  <div className="text-sm text-gray-500">
                    from {prediction.current_max} lbs
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
