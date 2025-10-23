#!/usr/bin/env python3
"""
Cost Monitoring and Optimization Script
Monitors costs and implements cost optimization strategies
"""

import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CostMonitor:
    """Cost monitoring and optimization for AI service"""
    
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.cost_explorer = boto3.client('ce')
        self.bedrock = boto3.client('bedrock-runtime')
        
        # Cost targets
        self.monthly_budget = 500  # USD
        self.daily_budget = self.monthly_budget / 30  # ~$16.67/day
        self.cost_per_user_target = 1.0  # USD per user per month
        
        # Cost tracking (minimal to reduce monitoring costs)
        self.cost_metrics = {
            'bedrock_tokens': 0,
            'lambda_invocations': 0,
            's3_storage': 0
        }
        
        # Pricing (as of 2024)
        self.pricing = {
            'bedrock_deepseek_input': 0.27 / 1000000,  # $0.27 per 1M input tokens
            'bedrock_deepseek_output': 1.10 / 1000000,  # $1.10 per 1M output tokens
            'bedrock_titan_embeddings': 0.10 / 1000000,  # $0.10 per 1M tokens
            'dynamodb_read': 0.25 / 1000000,  # $0.25 per 1M read requests
            'dynamodb_write': 1.25 / 1000000,  # $1.25 per 1M write requests
            'lambda_invocation': 0.20 / 1000000,  # $0.20 per 1M invocations
            'lambda_duration': 0.0000166667,  # $0.0000166667 per GB-second
            's3_storage': 0.023 / 1024 / 1024 / 1024,  # $0.023 per GB per month
            'cloudwatch_logs': 0.50 / 1024 / 1024 / 1024  # $0.50 per GB ingested
        }
    
    async def get_current_costs(self) -> Dict[str, Any]:
        """Get current month's costs from AWS Cost Explorer"""
        try:
            logger.info("Fetching current month's costs...")
            
            # Get current month's costs
            end_date = datetime.now(timezone.utc).date()
            start_date = end_date.replace(day=1)
            
            response = self.cost_explorer.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Metrics=['BlendedCost'],
                GroupBy=[
                    {
                        'Type': 'DIMENSION',
                        'Key': 'SERVICE'
                    }
                ]
            )
            
            costs_by_service = {}
            total_cost = 0
            
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    service = group['Keys'][0]
                    cost = float(group['Metrics']['BlendedCost']['Amount'])
                    costs_by_service[service] = cost
                    total_cost += cost
            
            return {
                'total_cost': total_cost,
                'costs_by_service': costs_by_service,
                'budget_utilization': (total_cost / self.monthly_budget) * 100,
                'days_remaining': (end_date - start_date).days,
                'daily_average': total_cost / (end_date - start_date).days if (end_date - start_date).days > 0 else 0,
                'cost_date': end_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error fetching current costs: {e}")
            return {'error': str(e)}
    
    async def estimate_token_costs(self, user_count: int = 500) -> Dict[str, Any]:
        """Estimate token costs based on usage patterns"""
        try:
            logger.info(f"Estimating token costs for {user_count} users...")
            
            # Usage assumptions per user per month
            usage_per_user = {
                'avg_chat_sessions': 20,
                'avg_messages_per_session': 5,
                'avg_input_tokens_per_message': 50,
                'avg_output_tokens_per_message': 150,
                'avg_rag_queries_per_session': 2,
                'avg_embedding_tokens_per_query': 20
            }
            
            # Calculate monthly usage
            monthly_input_tokens = (
                user_count * 
                usage_per_user['avg_chat_sessions'] * 
                usage_per_user['avg_messages_per_session'] * 
                usage_per_user['avg_input_tokens_per_message']
            )
            
            monthly_output_tokens = (
                user_count * 
                usage_per_user['avg_chat_sessions'] * 
                usage_per_user['avg_messages_per_session'] * 
                usage_per_user['avg_output_tokens_per_message']
            )
            
            monthly_embedding_tokens = (
                user_count * 
                usage_per_user['avg_chat_sessions'] * 
                usage_per_user['avg_rag_queries_per_session'] * 
                usage_per_user['avg_embedding_tokens_per_query']
            )
            
            # Calculate costs
            input_cost = monthly_input_tokens * self.pricing['bedrock_deepseek_input']
            output_cost = monthly_output_tokens * self.pricing['bedrock_deepseek_output']
            embedding_cost = monthly_embedding_tokens * self.pricing['bedrock_titan_embeddings']
            
            total_bedrock_cost = input_cost + output_cost + embedding_cost
            
            return {
                'user_count': user_count,
                'monthly_usage': {
                    'input_tokens': monthly_input_tokens,
                    'output_tokens': monthly_output_tokens,
                    'embedding_tokens': monthly_embedding_tokens
                },
                'monthly_costs': {
                    'input_cost': input_cost,
                    'output_cost': output_cost,
                    'embedding_cost': embedding_cost,
                    'total_bedrock_cost': total_bedrock_cost
                },
                'cost_per_user': total_bedrock_cost / user_count,
                'meets_target': (total_bedrock_cost / user_count) <= self.cost_per_user_target
            }
            
        except Exception as e:
            logger.error(f"Error estimating token costs: {e}")
            return {'error': str(e)}
    
    async def estimate_infrastructure_costs(self, user_count: int = 500) -> Dict[str, Any]:
        """Estimate infrastructure costs"""
        try:
            logger.info(f"Estimating infrastructure costs for {user_count} users...")
            
            # Usage assumptions
            monthly_requests = user_count * 100  # 100 requests per user per month
            avg_request_size = 10  # KB
            avg_response_size = 5  # KB
            avg_execution_time = 2  # seconds
            avg_memory_usage = 512  # MB
            
            # DynamoDB costs
            dynamodb_reads = monthly_requests * 5  # 5 reads per request
            dynamodb_writes = monthly_requests * 2  # 2 writes per request
            
            dynamodb_read_cost = dynamodb_reads * self.pricing['dynamodb_read']
            dynamodb_write_cost = dynamodb_writes * self.pricing['dynamodb_write']
            total_dynamodb_cost = dynamodb_read_cost + dynamodb_write_cost
            
            # Lambda costs
            lambda_invocations = monthly_requests
            lambda_duration_cost = (
                lambda_invocations * 
                (avg_execution_time / 1000) * 
                (avg_memory_usage / 1024) * 
                self.pricing['lambda_duration']
            )
            
            total_lambda_cost = (
                lambda_invocations * self.pricing['lambda_invocation'] + 
                lambda_duration_cost
            )
            
            # S3 costs (assuming 10GB storage)
            s3_storage_gb = 10
            s3_cost = s3_storage_gb * self.pricing['s3_storage']
            
            # CloudWatch costs (assuming 1GB logs per month)
            cloudwatch_logs_gb = 1
            cloudwatch_cost = cloudwatch_logs_gb * self.pricing['cloudwatch_logs']
            
            total_infrastructure_cost = (
                total_dynamodb_cost + 
                total_lambda_cost + 
                s3_cost + 
                cloudwatch_cost
            )
            
            return {
                'user_count': user_count,
                'monthly_usage': {
                    'requests': monthly_requests,
                    'dynamodb_reads': dynamodb_reads,
                    'dynamodb_writes': dynamodb_writes,
                    'lambda_invocations': lambda_invocations,
                    's3_storage_gb': s3_storage_gb,
                    'cloudwatch_logs_gb': cloudwatch_logs_gb
                },
                'monthly_costs': {
                    'dynamodb_cost': total_dynamodb_cost,
                    'lambda_cost': total_lambda_cost,
                    's3_cost': s3_cost,
                    'cloudwatch_cost': cloudwatch_cost,
                    'total_infrastructure_cost': total_infrastructure_cost
                },
                'cost_per_user': total_infrastructure_cost / user_count
            }
            
        except Exception as e:
            logger.error(f"Error estimating infrastructure costs: {e}")
            return {'error': str(e)}
    
    async def generate_cost_optimization_recommendations(self) -> Dict[str, Any]:
        """Generate cost optimization recommendations"""
        try:
            logger.info("Generating cost optimization recommendations...")
            
            recommendations = {
                'immediate_actions': [],
                'medium_term_optimizations': [],
                'long_term_strategies': [],
                'monitoring_recommendations': []
            }
            
            # Immediate actions
            recommendations['immediate_actions'] = [
                {
                    'action': 'Implement token budget per user',
                    'description': 'Set daily/monthly token limits per user to control costs',
                    'estimated_savings': '20-30%',
                    'implementation_effort': 'Low'
                },
                {
                    'action': 'Optimize prompt length',
                    'description': 'Reduce system prompt and context length for simple queries',
                    'estimated_savings': '15-25%',
                    'implementation_effort': 'Low'
                },
                {
                    'action': 'Implement response caching',
                    'description': 'Cache common responses to reduce Bedrock calls',
                    'estimated_savings': '10-20%',
                    'implementation_effort': 'Medium'
                },
                {
                    'action': 'Add request rate limiting',
                    'description': 'Implement rate limiting to prevent abuse',
                    'estimated_savings': '5-15%',
                    'implementation_effort': 'Low'
                }
            ]
            
            # Medium term optimizations
            recommendations['medium_term_optimizations'] = [
                {
                    'action': 'Implement context summarization',
                    'description': 'Summarize long conversations to reduce token usage',
                    'estimated_savings': '25-40%',
                    'implementation_effort': 'Medium'
                },
                {
                    'action': 'Optimize RAG retrieval',
                    'description': 'Improve RAG efficiency to reduce embedding costs',
                    'estimated_savings': '15-25%',
                    'implementation_effort': 'Medium'
                },
                {
                    'action': 'Implement batch processing',
                    'description': 'Batch similar requests to reduce overhead',
                    'estimated_savings': '10-20%',
                    'implementation_effort': 'Medium'
                },
                {
                    'action': 'Add cost monitoring alerts',
                    'description': 'Set up alerts for cost thresholds',
                    'estimated_savings': '5-10%',
                    'implementation_effort': 'Low'
                }
            ]
            
            # Long term strategies
            recommendations['long_term_strategies'] = [
                {
                    'action': 'Implement model fine-tuning',
                    'description': 'Fine-tune models for specific use cases to reduce prompt length',
                    'estimated_savings': '30-50%',
                    'implementation_effort': 'High'
                },
                {
                    'action': 'Add edge computing',
                    'description': 'Use edge computing for frequently accessed data',
                    'estimated_savings': '20-30%',
                    'implementation_effort': 'High'
                },
                {
                    'action': 'Implement hybrid search',
                    'description': 'Combine vector and keyword search for better efficiency',
                    'estimated_savings': '15-25%',
                    'implementation_effort': 'High'
                },
                {
                    'action': 'Add predictive caching',
                    'description': 'Predict user needs and pre-cache responses',
                    'estimated_savings': '25-35%',
                    'implementation_effort': 'High'
                }
            ]
            
            # Monitoring recommendations
            recommendations['monitoring_recommendations'] = [
                'Set up CloudWatch dashboards for cost tracking',
                'Implement daily cost alerts',
                'Monitor cost per user metrics',
                'Track token usage patterns',
                'Set up budget alerts in AWS Cost Explorer',
                'Monitor API usage and response times',
                'Track cache hit rates and optimization opportunities'
            ]
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating cost optimization recommendations: {e}")
            return {'error': str(e)}
    
    async def create_cost_monitoring_dashboard(self) -> Dict[str, Any]:
        """Create CloudWatch dashboard for cost monitoring"""
        try:
            logger.info("Creating cost monitoring dashboard...")
            
            dashboard_body = {
                "widgets": [
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/Bedrock", "Invocations", "ModelId", "deepseek-r1"],
                                [".", "InputTokens", ".", "."],
                                [".", "OutputTokens", ".", "."]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": "us-east-1",
                            "title": "Bedrock Usage",
                            "period": 300
                        }
                    },
                    {
                        "type": "metric",
                        "x": 12,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "gymcoach-ai-main"],
                                [".", "ConsumedWriteCapacityUnits", ".", "."]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": "us-east-1",
                            "title": "DynamoDB Usage",
                            "period": 300
                        }
                    },
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 6,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/Lambda", "Invocations", "FunctionName", "ai-service-lambda"],
                                [".", "Duration", ".", "."],
                                [".", "Errors", ".", "."]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": "us-east-1",
                            "title": "Lambda Performance",
                            "period": 300
                        }
                    },
                    {
                        "type": "metric",
                        "x": 12,
                        "y": 6,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                ["AWS/S3", "BucketSizeBytes", "BucketName", "gymcoach-ai-vectors", "StorageType", "StandardStorage"]
                            ],
                            "view": "timeSeries",
                            "stacked": False,
                            "region": "us-east-1",
                            "title": "S3 Storage Usage",
                            "period": 300
                        }
                    }
                ]
            }
            
            try:
                self.cloudwatch.put_dashboard(
                    DashboardName='AI-Service-Cost-Monitoring',
                    DashboardBody=json.dumps(dashboard_body)
                )
                
                return {
                    'dashboard_created': True,
                    'dashboard_name': 'AI-Service-Cost-Monitoring',
                    'dashboard_url': f"https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AI-Service-Cost-Monitoring"
                }
                
            except ClientError as e:
                logger.warning(f"Could not create dashboard: {e}")
                return {
                    'dashboard_created': False,
                    'error': str(e),
                    'dashboard_body': dashboard_body
                }
            
        except Exception as e:
            logger.error(f"Error creating cost monitoring dashboard: {e}")
            return {'error': str(e)}
    
    async def run_comprehensive_cost_analysis(self) -> Dict[str, Any]:
        """Run comprehensive cost analysis"""
        try:
            logger.info("Running comprehensive cost analysis...")
            
            analysis_results = {}
            
            # Get current costs
            analysis_results['current_costs'] = await self.get_current_costs()
            
            # Estimate token costs
            analysis_results['token_cost_estimation'] = await self.estimate_token_costs()
            
            # Estimate infrastructure costs
            analysis_results['infrastructure_cost_estimation'] = await self.estimate_infrastructure_costs()
            
            # Generate optimization recommendations
            analysis_results['optimization_recommendations'] = await self.generate_cost_optimization_recommendations()
            
            # Create monitoring dashboard
            analysis_results['monitoring_dashboard'] = await self.create_cost_monitoring_dashboard()
            
            # Calculate total estimated costs
            token_costs = analysis_results['token_cost_estimation'].get('monthly_costs', {}).get('total_bedrock_cost', 0)
            infrastructure_costs = analysis_results['infrastructure_cost_estimation'].get('monthly_costs', {}).get('total_infrastructure_cost', 0)
            total_estimated_cost = token_costs + infrastructure_costs
            
            analysis_results['cost_summary'] = {
                'total_estimated_monthly_cost': total_estimated_cost,
                'bedrock_cost': token_costs,
                'infrastructure_cost': infrastructure_costs,
                'budget_utilization': (total_estimated_cost / self.monthly_budget) * 100,
                'meets_budget': total_estimated_cost <= self.monthly_budget,
                'cost_per_user': total_estimated_cost / 500,  # Assuming 500 users
                'analysis_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            return analysis_results
            
        except Exception as e:
            logger.error(f"Error in comprehensive cost analysis: {e}")
            return {'error': str(e)}

async def main():
    """Main function to run cost analysis"""
    try:
        cost_monitor = CostMonitor()
        
        logger.info("Starting AI Service Cost Analysis...")
        
        # Run comprehensive cost analysis
        results = await cost_monitor.run_comprehensive_cost_analysis()
        
        if 'error' in results:
            logger.error(f"Cost analysis failed: {results['error']}")
            return
        
        # Save results
        results_file = f"cost_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Cost analysis completed successfully!")
        logger.info(f"Results saved to: {results_file}")
        
        # Print summary
        cost_summary = results['cost_summary']
        logger.info(f"Total estimated monthly cost: ${cost_summary['total_estimated_monthly_cost']:.2f}")
        logger.info(f"Budget utilization: {cost_summary['budget_utilization']:.1f}%")
        logger.info(f"Meets budget: {cost_summary['meets_budget']}")
        logger.info(f"Cost per user: ${cost_summary['cost_per_user']:.2f}")
        
        # Print key recommendations
        recommendations = results['optimization_recommendations']
        logger.info("Key Cost Optimization Recommendations:")
        for category, recs in recommendations.items():
            if isinstance(recs, list) and recs:
                logger.info(f"{category.replace('_', ' ').title()}:")
                for rec in recs[:3]:  # Show first 3 recommendations
                    if isinstance(rec, dict):
                        logger.info(f"  - {rec['action']}: {rec['description']} (Savings: {rec['estimated_savings']})")
                    else:
                        logger.info(f"  - {rec}")
        
    except Exception as e:
        logger.error(f"Error in main cost analysis: {e}")

if __name__ == "__main__":
    asyncio.run(main())
