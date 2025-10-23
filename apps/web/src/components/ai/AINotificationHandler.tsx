// AI Notification Handler Component
import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  TrendingUp,
  Target,
  Brain,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import type {
  ProactiveInsight,
  ProgressMonitoringAlert,
} from '../../types/ai-service';

interface AINotificationProps {
  className?: string;
}

export function AINotificationHandler({ className = '' }: AINotificationProps) {
  const [notifications, setNotifications] = useState<
    (ProactiveInsight | ProgressMonitoringAlert)[]
  >([]);
  const [isVisible, setIsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadAINotifications();

    // Set up polling for new notifications
    const interval = setInterval(loadAINotifications, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadAINotifications = async () => {
    try {
      // Load proactive insights as notifications
      const insightsResponse = await aiService.getProactiveInsights();
      if (insightsResponse.success) {
        const insights = insightsResponse.data.filter(
          (insight) => insight.actionRequired && insight.priority === 'high'
        );
        setNotifications((prev) => {
          const newNotifications = insights.filter(
            (insight) => !prev.some((n) => n.id === insight.id)
          );
          return [...newNotifications, ...prev].slice(0, 10); // Keep last 10
        });
        setUnreadCount(insights.length);
      }

      // Load progress monitoring alerts
      const progressResponse = await aiService.monitorProgress();
      if (progressResponse.success && progressResponse.data.alerts) {
        const alerts = progressResponse.data.alerts.filter(
          (alert) => alert.actionRequired && alert.severity === 'high'
        );
        setNotifications((prev) => {
          const newAlerts = alerts.filter(
            (alert) => !prev.some((n) => n.id === alert.id)
          );
          return [...newAlerts, ...prev].slice(0, 10);
        });
        setUnreadCount((prev) => prev + alerts.length);
      }
    } catch (error) {
      console.error('Failed to load AI notifications:', error);
    }
  };

  const getNotificationIcon = (
    notification: ProactiveInsight | ProgressMonitoringAlert
  ) => {
    if ('type' in notification) {
      // ProactiveInsight
      const icons = {
        'check-in': <MessageSquare className="h-4 w-4" />,
        motivation: <Zap className="h-4 w-4" />,
        plateau: <AlertCircle className="h-4 w-4" />,
        progress: <TrendingUp className="h-4 w-4" />,
        review: <BarChart3 className="h-4 w-4" />,
      };
      return (
        icons[notification.type as keyof typeof icons] || (
          <Brain className="h-4 w-4" />
        )
      );
    } else {
      // ProgressMonitoringAlert
      const icons = {
        deviation: <AlertCircle className="h-4 w-4" />,
        plateau: <TrendingUp className="h-4 w-4" />,
        improvement: <CheckCircle className="h-4 w-4" />,
        risk: <AlertCircle className="h-4 w-4" />,
      };
      return (
        icons[notification.type as keyof typeof icons] || (
          <Info className="h-4 w-4" />
        )
      );
    }
  };

  const getNotificationColor = (
    notification: ProactiveInsight | ProgressMonitoringAlert
  ) => {
    const priority =
      'priority' in notification
        ? notification.priority
        : notification.severity;
    const colors = {
      low: 'bg-blue-50 border-blue-200 text-blue-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      high: 'bg-red-50 border-red-200 text-red-800',
    };
    return (
      colors[priority as keyof typeof colors] ||
      'bg-gray-50 border-gray-200 text-gray-800'
    );
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAsRead = () => {
    setUnreadCount(0);
  };

  const handleNotificationClick = (
    notification: ProactiveInsight | ProgressMonitoringAlert
  ) => {
    // Navigate to relevant page or open AI trainer
    if ('type' in notification) {
      // Proactive insight - open AI trainer
      window.location.href = '/ai-trainer';
    } else {
      // Progress alert - open analytics or dashboard
      window.location.href = '/dashboard';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      {isVisible && (
        <div className="absolute top-16 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-600" />
                AI Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${getNotificationColor(notification)}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">
                          {'title' in notification
                            ? notification.title
                            : notification.title}
                        </h4>
                        <p className="text-sm opacity-90 mb-2">
                          {'message' in notification
                            ? notification.message
                            : notification.description}
                        </p>

                        {'suggestedActions' in notification &&
                          notification.suggestedActions.length > 0 && (
                            <div className="space-y-1">
                              {notification.suggestedActions
                                .slice(0, 2)
                                .map((action, index) => (
                                  <div
                                    key={index}
                                    className="text-xs bg-white/50 p-2 rounded"
                                  >
                                    {action}
                                  </div>
                                ))}
                            </div>
                          )}

                        {'recommendations' in notification &&
                          notification.recommendations.length > 0 && (
                            <div className="space-y-1">
                              {notification.recommendations
                                .slice(0, 2)
                                .map((rec, index) => (
                                  <div
                                    key={index}
                                    className="text-xs bg-white/50 p-2 rounded"
                                  >
                                    {rec}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(notification.id);
                        }}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-75">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1">
                        {'confidence' in notification && (
                          <span className="text-xs opacity-75">
                            {(notification.confidence * 100).toFixed(0)}%
                            confidence
                          </span>
                        )}
                        <Target className="h-3 w-3 opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsVisible(false);
                  window.location.href = '/ai-trainer';
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all AI insights →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Progress Monitoring Alert Component
interface ProgressAlertProps {
  alert: ProgressMonitoringAlert;
  onDismiss: (id: string) => void;
  className?: string;
}

export function ProgressAlert({
  alert,
  onDismiss,
  className = '',
}: ProgressAlertProps) {
  const getSeverityIcon = (severity: string) => {
    const icons = {
      low: <Info className="h-4 w-4" />,
      medium: <AlertCircle className="h-4 w-4" />,
      high: <AlertCircle className="h-4 w-4" />,
    };
    return (
      icons[severity as keyof typeof icons] || <Info className="h-4 w-4" />
    );
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-blue-50 border-blue-200 text-blue-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      high: 'bg-red-50 border-red-200 text-red-800',
    };
    return (
      colors[severity as keyof typeof colors] ||
      'bg-gray-50 border-gray-200 text-gray-800'
    );
  };

  return (
    <div
      className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon(alert.severity)}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-sm mb-1">{alert.title}</h4>
              <p className="text-sm opacity-90 mb-2">{alert.description}</p>

              {alert.metrics.length > 0 && (
                <div className="space-y-1 mb-2">
                  {alert.metrics.slice(0, 2).map((metric, index) => (
                    <div
                      key={index}
                      className="text-xs bg-white/50 p-2 rounded"
                    >
                      <span className="font-medium">{metric.name}:</span>{' '}
                      {metric.current}
                      {metric.expected && ` (expected: ${metric.expected})`}
                      <span
                        className={`ml-2 ${
                          metric.trend === 'up'
                            ? 'text-green-600'
                            : metric.trend === 'down'
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {metric.trend === 'up'
                          ? '↗'
                          : metric.trend === 'down'
                            ? '↘'
                            : '→'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {alert.recommendations.length > 0 && (
                <div className="space-y-1">
                  {alert.recommendations.slice(0, 2).map((rec, index) => (
                    <div
                      key={index}
                      className="text-xs bg-white/50 p-2 rounded"
                    >
                      {rec}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs opacity-75">
              {new Date(alert.createdAt).toLocaleDateString()}
            </span>
            <span className="text-xs opacity-75 capitalize">
              {alert.severity} priority
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AINotificationHandler;
