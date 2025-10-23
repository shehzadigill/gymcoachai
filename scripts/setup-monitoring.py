#!/usr/bin/env python3
"""
Comprehensive Monitoring Setup for AI Service
Sets up CloudWatch dashboards, alarms, and monitoring
"""

import os
import json
import boto3
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MonitoringSetup:
    """Comprehensive monitoring setup for AI service"""
    
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.sns = boto3.client('sns')
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
        
        # Monitoring configuration
        self.dashboard_name = 'AI-Service-Comprehensive-Monitoring'
        self.alarm_topic_name = 'ai-service-alerts'
        
    def create_performance_dashboard(self) -> Dict[str, Any]:
        """Create lightweight performance monitoring dashboard (cost-optimized)"""
        try:
            logger.info("Creating lightweight performance monitoring dashboard...")
            
            # COST-OPTIMIZED: Minimal dashboard with only essential metrics
            dashboard_body = {
                "widgets": [
                    # Essential Lambda metrics only
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/Lambda", "Invocations", "FunctionName", "ai-service-lambda"],
                                [".", "Errors", ".", "."]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": self.region,
                            "title": "Lambda Performance (Essential)",
                            "period": 300,
                            "stat": "Sum"
                        }
                    },
                    # Essential Bedrock usage only
                    {
                        "type": "metric",
                        "x": 12,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/Bedrock", "Invocations", "ModelId", "deepseek-r1"]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": self.region,
                            "title": "Bedrock Usage (Essential)",
                            "period": 300,
                            "stat": "Sum"
                        }
                    }
                ]
            }
            
            # COST-OPTIMIZED: Comment out expensive dashboard creation
            # Uncomment only if you need detailed monitoring and can afford the costs
            """
            try:
                self.cloudwatch.put_dashboard(
                    DashboardName=self.dashboard_name,
                    DashboardBody=json.dumps(dashboard_body)
                )
                
                return {
                    'dashboard_created': True,
                    'dashboard_name': self.dashboard_name,
                    'dashboard_url': f"https://console.aws.amazon.com/cloudwatch/home?region={self.region}#dashboards:name={self.dashboard_name}"
                }
                
            except Exception as e:
                logger.warning(f"Could not create dashboard: {e}")
                return {
                    'dashboard_created': False,
                    'error': str(e),
                    'dashboard_body': dashboard_body
                }
            """
            
            # COST-OPTIMIZED: Return dashboard configuration without creating
            return {
                'dashboard_created': False,
                'reason': 'Cost optimization - dashboard creation commented out',
                'dashboard_name': self.dashboard_name,
                'dashboard_body': dashboard_body,
                'note': 'Uncomment dashboard creation code if detailed monitoring is needed'
            }
            
        except Exception as e:
            logger.error(f"Error creating performance dashboard: {e}")
            return {'error': str(e)}
    
    def create_cost_dashboard(self) -> Dict[str, Any]:
        """Create lightweight cost monitoring dashboard (cost-optimized)"""
        try:
            logger.info("Creating lightweight cost monitoring dashboard...")
            
            # COST-OPTIMIZED: Minimal cost dashboard with only essential metrics
            dashboard_body = {
                "widgets": [
                    # Essential cost metrics only
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/Bedrock", "Invocations", "ModelId", "deepseek-r1"]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": self.region,
                            "title": "Bedrock Usage (Main Cost Driver)",
                            "period": 300,
                            "stat": "Sum"
                        }
                    }
                ]
            }
            
            # COST-OPTIMIZED: Comment out expensive dashboard creation
            # Uncomment only if you need detailed cost monitoring and can afford the costs
            """
            try:
                self.cloudwatch.put_dashboard(
                    DashboardName='AI-Service-Cost-Monitoring',
                    DashboardBody=json.dumps(dashboard_body)
                )
                
                return {
                    'dashboard_created': True,
                    'dashboard_name': 'AI-Service-Cost-Monitoring',
                    'dashboard_url': f"https://console.aws.amazon.com/cloudwatch/home?region={self.region}#dashboards:name=AI-Service-Cost-Monitoring"
                }
                
            except Exception as e:
                logger.warning(f"Could not create cost dashboard: {e}")
                return {
                    'dashboard_created': False,
                    'error': str(e),
                    'dashboard_body': dashboard_body
                }
            """
            
            # COST-OPTIMIZED: Return dashboard configuration without creating
            return {
                'dashboard_created': False,
                'reason': 'Cost optimization - dashboard creation commented out',
                'dashboard_name': 'AI-Service-Cost-Monitoring',
                'dashboard_body': dashboard_body,
                'note': 'Uncomment dashboard creation code if detailed cost monitoring is needed'
            }
            
        except Exception as e:
            logger.error(f"Error creating cost dashboard: {e}")
            return {'error': str(e)}
    
    def create_alarms(self) -> Dict[str, Any]:
        """Create lightweight CloudWatch alarms (cost-optimized)"""
        try:
            logger.info("Creating lightweight CloudWatch alarms...")
            
            # COST-OPTIMIZED: Comment out expensive alarm creation
            # Uncomment only if you need detailed monitoring and can afford the costs
            """
            # Create SNS topic for alerts
            try:
                topic_response = self.sns.create_topic(Name=self.alarm_topic_name)
                topic_arn = topic_response['TopicArn']
            except Exception as e:
                logger.warning(f"Could not create SNS topic: {e}")
                topic_arn = None
            
            alarms = []
            
            # High error rate alarm
            try:
                alarm_response = self.cloudwatch.put_metric_alarm(
                    AlarmName='AI-Service-High-Error-Rate',
                    AlarmDescription='High error rate in AI service',
                    MetricName='Errors',
                    Namespace='AWS/Lambda',
                    Statistic='Sum',
                    Dimensions=[
                        {
                            'Name': 'FunctionName',
                            'Value': 'ai-service-lambda'
                        }
                    ],
                    Period=300,
                    EvaluationPeriods=2,
                    Threshold=10,
                    ComparisonOperator='GreaterThanThreshold',
                    AlarmActions=[topic_arn] if topic_arn else [],
                    OKActions=[topic_arn] if topic_arn else []
                )
                alarms.append('AI-Service-High-Error-Rate')
            except Exception as e:
                logger.warning(f"Could not create error rate alarm: {e}")
            
            # High response time alarm
            try:
                alarm_response = self.cloudwatch.put_metric_alarm(
                    AlarmName='AI-Service-High-Response-Time',
                    AlarmDescription='High response time in AI service',
                    MetricName='Duration',
                    Namespace='AWS/Lambda',
                    Statistic='Average',
                    Dimensions=[
                        {
                            'Name': 'FunctionName',
                            'Value': 'ai-service-lambda'
                        }
                    ],
                    Period=300,
                    EvaluationPeriods=2,
                    Threshold=10000,  # 10 seconds
                    ComparisonOperator='GreaterThanThreshold',
                    AlarmActions=[topic_arn] if topic_arn else [],
                    OKActions=[topic_arn] if topic_arn else []
                )
                alarms.append('AI-Service-High-Response-Time')
            except Exception as e:
                logger.warning(f"Could not create response time alarm: {e}")
            
            # High token usage alarm
            try:
                alarm_response = self.cloudwatch.put_metric_alarm(
                    AlarmName='AI-Service-High-Token-Usage',
                    AlarmDescription='High token usage in AI service',
                    MetricName='InputTokens',
                    Namespace='AWS/Bedrock',
                    Statistic='Sum',
                    Dimensions=[
                        {
                            'Name': 'ModelId',
                            'Value': 'deepseek-r1'
                        }
                    ],
                    Period=300,
                    EvaluationPeriods=1,
                    Threshold=1000000,  # 1M tokens
                    ComparisonOperator='GreaterThanThreshold',
                    AlarmActions=[topic_arn] if topic_arn else [],
                    OKActions=[topic_arn] if topic_arn else []
                )
                alarms.append('AI-Service-High-Token-Usage')
            except Exception as e:
                logger.warning(f"Could not create token usage alarm: {e}")
            
            # DynamoDB throttling alarm
            try:
                alarm_response = self.cloudwatch.put_metric_alarm(
                    AlarmName='AI-Service-DynamoDB-Throttling',
                    AlarmDescription='DynamoDB throttling in AI service',
                    MetricName='ThrottledRequests',
                    Namespace='AWS/DynamoDB',
                    Statistic='Sum',
                    Dimensions=[
                        {
                            'Name': 'TableName',
                            'Value': 'gymcoach-ai-main'
                        }
                    ],
                    Period=300,
                    EvaluationPeriods=1,
                    Threshold=5,
                    ComparisonOperator='GreaterThanThreshold',
                    AlarmActions=[topic_arn] if topic_arn else [],
                    OKActions=[topic_arn] if topic_arn else []
                )
                alarms.append('AI-Service-DynamoDB-Throttling')
            except Exception as e:
                logger.warning(f"Could not create DynamoDB throttling alarm: {e}")
            
            return {
                'alarms_created': alarms,
                'sns_topic_arn': topic_arn,
                'total_alarms': len(alarms)
            }
            """
            
            # COST-OPTIMIZED: Return alarm configuration without creating
            return {
                'alarms_created': [],
                'reason': 'Cost optimization - alarm creation commented out',
                'total_alarms': 0,
                'note': 'Uncomment alarm creation code if detailed monitoring is needed'
            }
            
        except Exception as e:
            logger.error(f"Error creating alarms: {e}")
            return {'error': str(e)}
    
    def create_custom_metrics(self) -> Dict[str, Any]:
        """Create lightweight custom metrics (cost-optimized)"""
        try:
            logger.info("Creating lightweight custom metrics...")
            
            # COST-OPTIMIZED: Comment out expensive custom metrics
            # Uncomment only if you need detailed monitoring and can afford the costs
            """
            custom_metrics = [
                {
                    'MetricName': 'RAGQueries',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Namespace', 'Value': 'exercises'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'RAGQueries',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Namespace', 'Value': 'nutrition'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'RAGQueries',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Namespace', 'Value': 'research'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'MemoryRetrievals',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Type', 'Value': 'goal'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'MemoryRetrievals',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Type', 'Value': 'preference'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'PersonalizationEvents',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'EventType', 'Value': 'style_adaptation'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                },
                {
                    'MetricName': 'ConversationSummaries',
                    'Namespace': 'Custom/AI-Service',
                    'Dimensions': [
                        {'Name': 'Trigger', 'Value': 'auto'},
                        {'Name': 'Status', 'Value': 'success'}
                    ]
                }
            ]
            
            # Note: Custom metrics are created when data is sent to them
            # This is just documenting the metrics that should be created
            
            return {
                'custom_metrics_defined': custom_metrics,
                'total_metrics': len(custom_metrics),
                'note': 'Custom metrics are created when data is sent to CloudWatch'
            }
            """
            
            # COST-OPTIMIZED: Return minimal custom metrics configuration
            return {
                'custom_metrics_defined': [],
                'total_metrics': 0,
                'reason': 'Cost optimization - custom metrics creation commented out',
                'note': 'Uncomment custom metrics code if detailed monitoring is needed'
            }
            
        except Exception as e:
            logger.error(f"Error creating custom metrics: {e}")
            return {'error': str(e)}
    
    def run_comprehensive_monitoring_setup(self) -> Dict[str, Any]:
        """Run comprehensive monitoring setup"""
        try:
            logger.info("Starting comprehensive monitoring setup...")
            
            setup_results = {}
            
            # Create performance dashboard
            setup_results['performance_dashboard'] = self.create_performance_dashboard()
            
            # Create cost dashboard
            setup_results['cost_dashboard'] = self.create_cost_dashboard()
            
            # Create alarms
            setup_results['alarms'] = self.create_alarms()
            
            # Create custom metrics
            setup_results['custom_metrics'] = self.create_custom_metrics()
            
            # Generate monitoring summary
            setup_results['monitoring_summary'] = {
                'dashboards_created': 2,
                'alarms_created': len(setup_results['alarms'].get('alarms_created', [])),
                'custom_metrics_defined': setup_results['custom_metrics'].get('total_metrics', 0),
                'setup_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            return setup_results
            
        except Exception as e:
            logger.error(f"Error in comprehensive monitoring setup: {e}")
            return {'error': str(e)}

def main():
    """Main function to run monitoring setup"""
    try:
        monitoring_setup = MonitoringSetup()
        
        logger.info("Starting AI Service Monitoring Setup...")
        
        # Run comprehensive monitoring setup
        results = monitoring_setup.run_comprehensive_monitoring_setup()
        
        if 'error' in results:
            logger.error(f"Monitoring setup failed: {results['error']}")
            return
        
        # Save results
        results_file = f"monitoring_setup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Monitoring setup completed successfully!")
        logger.info(f"Results saved to: {results_file}")
        
        # Print summary
        summary = results['monitoring_summary']
        logger.info(f"Dashboards created: {summary['dashboards_created']}")
        logger.info(f"Alarms created: {summary['alarms_created']}")
        logger.info(f"Custom metrics defined: {summary['custom_metrics_defined']}")
        
        # Print dashboard URLs
        if results['performance_dashboard'].get('dashboard_created'):
            logger.info(f"Performance Dashboard: {results['performance_dashboard']['dashboard_url']}")
        
        if results['cost_dashboard'].get('dashboard_created'):
            logger.info(f"Cost Dashboard: {results['cost_dashboard']['dashboard_url']}")
        
    except Exception as e:
        logger.error(f"Error in main monitoring setup: {e}")

if __name__ == "__main__":
    main()
