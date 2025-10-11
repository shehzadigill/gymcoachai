"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
const cdk = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const cloudwatch_actions = require("aws-cdk-lib/aws-cloudwatch-actions");
const sns = require("aws-cdk-lib/aws-sns");
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create SNS topic for alerts
        this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
            topicName: 'gymcoach-ai-alarms',
            displayName: 'GymCoach AI Alarms',
        });
        // Create CloudWatch dashboards
        this.createLambdaDashboards(props.lambdaFunctions);
        this.createDatabaseDashboards(props.dynamoDbTable);
        this.createS3Dashboards(props.s3Buckets);
        this.createApplicationDashboards();
        // Create alarms
        this.createLambdaAlarms(props.lambdaFunctions);
        this.createDatabaseAlarms(props.dynamoDbTable);
        this.createS3Alarms(props.s3Buckets);
        this.createApplicationAlarms();
    }
    createLambdaDashboards(functions) {
        const dashboard = new cloudwatch.Dashboard(this, 'LambdaDashboard', {
            dashboardName: 'GymCoach-AI-Lambda-Metrics',
        });
        functions.forEach((func, index) => {
            const widget = new cloudwatch.GraphWidget({
                title: `${func.functionName} - Invocations & Errors`,
                left: [
                    func.metricInvocations({
                        period: cdk.Duration.minutes(5),
                        statistic: 'Sum',
                    }),
                    func.metricErrors({
                        period: cdk.Duration.minutes(5),
                        statistic: 'Sum',
                    }),
                ],
                leftYAxis: {
                    label: 'Count',
                },
                width: 12,
                height: 6,
            });
            dashboard.addWidgets(widget);
            const durationWidget = new cloudwatch.GraphWidget({
                title: `${func.functionName} - Duration & Throttles`,
                left: [
                    func.metricDuration({
                        period: cdk.Duration.minutes(5),
                        statistic: 'Average',
                    }),
                    func.metricThrottles({
                        period: cdk.Duration.minutes(5),
                        statistic: 'Sum',
                    }),
                ],
                leftYAxis: {
                    label: 'Duration (ms)',
                },
                rightYAxis: {
                    label: 'Throttles',
                },
                width: 12,
                height: 6,
            });
            dashboard.addWidgets(durationWidget);
            const memoryWidget = new cloudwatch.GraphWidget({
                title: `${func.functionName} - Memory Usage`,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/Lambda',
                        metricName: 'MaxMemoryUsed',
                        dimensionsMap: { FunctionName: func.functionName },
                        period: cdk.Duration.minutes(5),
                        statistic: 'Average',
                    }),
                ],
                leftYAxis: {
                    label: 'Memory Utilization (%)',
                },
                width: 12,
                height: 6,
            });
            dashboard.addWidgets(memoryWidget);
        });
    }
    createDatabaseDashboards(table) {
        const dashboard = new cloudwatch.Dashboard(this, 'DatabaseDashboard', {
            dashboardName: 'GymCoach-AI-Database-Metrics',
        });
        const readWriteWidget = new cloudwatch.GraphWidget({
            title: 'DynamoDB - Read/Write Capacity',
            left: [
                table.metricConsumedReadCapacityUnits({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                table.metricConsumedWriteCapacityUnits({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Capacity Units',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(readWriteWidget);
        const throttlingWidget = new cloudwatch.GraphWidget({
            title: 'DynamoDB - Throttling',
            left: [
                table.metricThrottledRequests({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Throttled Requests',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(throttlingWidget);
        const itemCountWidget = new cloudwatch.GraphWidget({
            title: 'DynamoDB - Item Count',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/DynamoDB',
                    metricName: 'ItemCount',
                    dimensionsMap: { TableName: table.tableName },
                    period: cdk.Duration.minutes(5),
                    statistic: 'Average',
                }),
            ],
            leftYAxis: {
                label: 'Item Count',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(itemCountWidget);
    }
    createS3Dashboards(buckets) {
        const dashboard = new cloudwatch.Dashboard(this, 'S3Dashboard', {
            dashboardName: 'GymCoach-AI-S3-Metrics',
        });
        buckets.forEach((bucket, index) => {
            const widget = new cloudwatch.GraphWidget({
                title: `${bucket.bucketName} - Storage & Requests`,
                left: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'BucketSizeBytes',
                        dimensionsMap: {
                            BucketName: bucket.bucketName,
                            StorageType: 'StandardStorage',
                        },
                        period: cdk.Duration.hours(1),
                        statistic: 'Average',
                    }),
                ],
                right: [
                    new cloudwatch.Metric({
                        namespace: 'AWS/S3',
                        metricName: 'NumberOfObjects',
                        dimensionsMap: {
                            BucketName: bucket.bucketName,
                            StorageType: 'AllStorageTypes',
                        },
                        period: cdk.Duration.hours(1),
                        statistic: 'Average',
                    }),
                ],
                leftYAxis: {
                    label: 'Storage (Bytes)',
                },
                rightYAxis: {
                    label: 'Object Count',
                },
                width: 12,
                height: 6,
            });
            dashboard.addWidgets(widget);
        });
    }
    createApplicationDashboards() {
        const dashboard = new cloudwatch.Dashboard(this, 'ApplicationDashboard', {
            dashboardName: 'GymCoach-AI-Application-Metrics',
        });
        // Custom application metrics
        const customMetricsWidget = new cloudwatch.GraphWidget({
            title: 'Custom Application Metrics',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI',
                    metricName: 'UserRegistrations',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI',
                    metricName: 'WorkoutSessions',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Count',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(customMetricsWidget);
        const errorRateWidget = new cloudwatch.GraphWidget({
            title: 'Error Rate by Service',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI',
                    metricName: 'ErrorRate',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Average',
                }),
            ],
            leftYAxis: {
                label: 'Error Rate (%)',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(errorRateWidget);
        // AI Service specific metrics
        this.createAIServiceDashboards(dashboard);
    }
    createAIServiceDashboards(dashboard) {
        // AI Chat Metrics
        const aiChatWidget = new cloudwatch.GraphWidget({
            title: 'AI Chat Service Metrics',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'ChatRequests',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'ChatErrors',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Count',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(aiChatWidget);
        // Bedrock Token Usage
        const tokenUsageWidget = new cloudwatch.GraphWidget({
            title: 'Bedrock Token Usage',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'InputTokens',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'OutputTokens',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Tokens',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(tokenUsageWidget);
        // Rate Limiting Metrics
        const rateLimitWidget = new cloudwatch.GraphWidget({
            title: 'Rate Limiting & Usage',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'RateLimitHits',
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'DailyUsage',
                    period: cdk.Duration.hours(1),
                    statistic: 'Average',
                }),
            ],
            leftYAxis: {
                label: 'Count',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(rateLimitWidget);
        // Cost Estimation
        const costWidget = new cloudwatch.GraphWidget({
            title: 'Estimated AI Service Costs (USD)',
            left: [
                new cloudwatch.Metric({
                    namespace: 'GymCoachAI/AI',
                    metricName: 'EstimatedCost',
                    period: cdk.Duration.hours(1),
                    statistic: 'Sum',
                }),
            ],
            leftYAxis: {
                label: 'Cost (USD)',
            },
            width: 12,
            height: 6,
        });
        dashboard.addWidgets(costWidget);
    }
    createLambdaAlarms(functions) {
        functions.forEach((func) => {
            // High error rate alarm
            const errorRateAlarm = new cloudwatch.Alarm(this, `${func.functionName}ErrorRateAlarm`, {
                alarmName: `${func.functionName}-High-Error-Rate`,
                metric: func.metricErrors({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                threshold: 10,
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
            // High duration alarm
            const durationAlarm = new cloudwatch.Alarm(this, `${func.functionName}DurationAlarm`, {
                alarmName: `${func.functionName}-High-Duration`,
                metric: func.metricDuration({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Average',
                }),
                threshold: 25000, // 25 seconds
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
            // High memory utilization alarm
            const memoryAlarm = new cloudwatch.Alarm(this, `${func.functionName}MemoryAlarm`, {
                alarmName: `${func.functionName}-High-Memory-Usage`,
                metric: new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'MaxMemoryUsed',
                    dimensionsMap: { FunctionName: func.functionName },
                    period: cdk.Duration.minutes(5),
                    statistic: 'Average',
                }),
                threshold: 80, // 80%
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            memoryAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
            // Throttling alarm
            const throttlingAlarm = new cloudwatch.Alarm(this, `${func.functionName}ThrottlingAlarm`, {
                alarmName: `${func.functionName}-Throttling`,
                metric: func.metricThrottles({
                    period: cdk.Duration.minutes(5),
                    statistic: 'Sum',
                }),
                threshold: 5,
                evaluationPeriods: 1,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            throttlingAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        });
    }
    createDatabaseAlarms(table) {
        // High read capacity alarm
        const readCapacityAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadCapacityAlarm', {
            alarmName: 'DynamoDB-High-Read-Capacity',
            metric: table.metricConsumedReadCapacityUnits({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 1000,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        readCapacityAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // High write capacity alarm
        const writeCapacityAlarm = new cloudwatch.Alarm(this, 'DynamoDBWriteCapacityAlarm', {
            alarmName: 'DynamoDB-High-Write-Capacity',
            metric: table.metricConsumedWriteCapacityUnits({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 1000,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        writeCapacityAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // Throttling alarm
        const throttlingAlarm = new cloudwatch.Alarm(this, 'DynamoDBThrottlingAlarm', {
            alarmName: 'DynamoDB-Throttling',
            metric: table.metricThrottledRequests({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 10,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        throttlingAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    }
    createS3Alarms(buckets) {
        buckets.forEach((bucket, index) => {
            // High storage usage alarm
            const storageAlarm = new cloudwatch.Alarm(this, `${bucket.bucketName}StorageAlarm`, {
                alarmName: `${bucket.bucketName}-High-Storage-Usage`,
                metric: new cloudwatch.Metric({
                    namespace: 'AWS/S3',
                    metricName: 'BucketSizeBytes',
                    dimensionsMap: {
                        BucketName: bucket.bucketName,
                        StorageType: 'StandardStorage',
                    },
                    period: cdk.Duration.hours(1),
                    statistic: 'Average',
                }),
                threshold: 1000000000, // 1GB
                evaluationPeriods: 1,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            storageAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        });
    }
    createApplicationAlarms() {
        // High error rate alarm
        const errorRateAlarm = new cloudwatch.Alarm(this, 'ApplicationErrorRateAlarm', {
            alarmName: 'Application-High-Error-Rate',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI',
                metricName: 'ErrorRate',
                period: cdk.Duration.minutes(5),
                statistic: 'Average',
            }),
            threshold: 5, // 5%
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // Low user activity alarm
        const userActivityAlarm = new cloudwatch.Alarm(this, 'UserActivityAlarm', {
            alarmName: 'Application-Low-User-Activity',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI',
                metricName: 'ActiveUsers',
                period: cdk.Duration.hours(1),
                statistic: 'Average',
            }),
            threshold: 10,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        });
        userActivityAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // AI Service specific alarms
        this.createAIServiceAlarms();
    }
    createAIServiceAlarms() {
        // High AI service cost alarm
        const aiCostAlarm = new cloudwatch.Alarm(this, 'AIServiceCostAlarm', {
            alarmName: 'AI-Service-High-Cost',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI/AI',
                metricName: 'EstimatedCost',
                period: cdk.Duration.hours(1),
                statistic: 'Sum',
            }),
            threshold: 5, // $5 per hour
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        aiCostAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // High token usage alarm
        const tokenUsageAlarm = new cloudwatch.Alarm(this, 'AITokenUsageAlarm', {
            alarmName: 'AI-Service-High-Token-Usage',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI/AI',
                metricName: 'InputTokens',
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 100000, // 100k tokens per 5 minutes
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        tokenUsageAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // High rate limit hits alarm
        const rateLimitAlarm = new cloudwatch.Alarm(this, 'AIRateLimitAlarm', {
            alarmName: 'AI-Service-High-Rate-Limit-Hits',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI/AI',
                metricName: 'RateLimitHits',
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 10, // 10 rate limit hits per 5 minutes
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        rateLimitAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        // AI service error rate alarm
        const aiErrorAlarm = new cloudwatch.Alarm(this, 'AIServiceErrorAlarm', {
            alarmName: 'AI-Service-High-Error-Rate',
            metric: new cloudwatch.Metric({
                namespace: 'GymCoachAI/AI',
                metricName: 'ChatErrors',
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            }),
            threshold: 5, // 5 errors per 5 minutes
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        aiErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tb25pdG9yaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5REFBeUQ7QUFDekQseUVBQXlFO0FBQ3pFLDJDQUEyQztBQWEzQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFdBQVcsRUFBRSxvQkFBb0I7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBRW5DLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLHNCQUFzQixDQUFDLFNBQTRCO1FBQ3pELE1BQU0s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QUFDO1FBRUgsWUFBWSxDQUFDLGNBQWMsQ0FDekIsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUNsRCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBcHBCRCwwQ0FvcEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1vbml0b3JpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdO1xuICBkeW5hbW9EYlRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgczNCdWNrZXRzOiBzMy5CdWNrZXRbXTtcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhbGFybVRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBhbGVydHNcbiAgICB0aGlzLmFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGFybVRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktYWxhcm1zJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnR3ltQ29hY2ggQUkgQWxhcm1zJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIGRhc2hib2FyZHNcbiAgICB0aGlzLmNyZWF0ZUxhbWJkYURhc2hib2FyZHMocHJvcHMubGFtYmRhRnVuY3Rpb25zKTtcbiAgICB0aGlzLmNyZWF0ZURhdGFiYXNlRGFzaGJvYXJkcyhwcm9wcy5keW5hbW9EYlRhYmxlKTtcbiAgICB0aGlzLmNyZWF0ZVMzRGFzaGJvYXJkcyhwcm9wcy5zM0J1Y2tldHMpO1xuICAgIHRoaXMuY3JlYXRlQXBwbGljYXRpb25EYXNoYm9hcmRzKCk7XG5cbiAgICAvLyBDcmVhdGUgYWxhcm1zXG4gICAgdGhpcy5jcmVhdGVMYW1iZGFBbGFybXMocHJvcHMubGFtYmRhRnVuY3Rpb25zKTtcbiAgICB0aGlzLmNyZWF0ZURhdGFiYXNlQWxhcm1zKHByb3BzLmR5bmFtb0RiVGFibGUpO1xuICAgIHRoaXMuY3JlYXRlUzNBbGFybXMocHJvcHMuczNCdWNrZXRzKTtcbiAgICB0aGlzLmNyZWF0ZUFwcGxpY2F0aW9uQWxhcm1zKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYURhc2hib2FyZHMoZnVuY3Rpb25zOiBsYW1iZGEuRnVuY3Rpb25bXSkge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnTGFtYmRhRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0d5bUNvYWNoLUFJLUxhbWJkYS1NZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgd2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gSW52b2NhdGlvbnMgJiBFcnJvcnNgLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgZnVuYy5tZXRyaWNJbnZvY2F0aW9ucyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBmdW5jLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbGFiZWw6ICdDb3VudCcsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHdpZGdldCk7XG5cbiAgICAgIGNvbnN0IGR1cmF0aW9uV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gRHVyYXRpb24gJiBUaHJvdHRsZXNgLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgZnVuYy5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgZnVuYy5tZXRyaWNUaHJvdHRsZXMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnRHVyYXRpb24gKG1zKScsXG4gICAgICAgIH0sXG4gICAgICAgIHJpZ2h0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ1Rocm90dGxlcycsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGR1cmF0aW9uV2lkZ2V0KTtcblxuICAgICAgY29uc3QgbWVtb3J5V2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gTWVtb3J5IFVzYWdlYCxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdNYXhNZW1vcnlVc2VkJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRnVuY3Rpb25OYW1lOiBmdW5jLmZ1bmN0aW9uTmFtZSB9LFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ01lbW9yeSBVdGlsaXphdGlvbiAoJSknLFxuICAgICAgICB9LFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pO1xuXG4gICAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhtZW1vcnlXaWRnZXQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEYXRhYmFzZURhc2hib2FyZHModGFibGU6IGR5bmFtb2RiLlRhYmxlKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXRhYmFzZURhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdHeW1Db2FjaC1BSS1EYXRhYmFzZS1NZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlYWRXcml0ZVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnRHluYW1vREIgLSBSZWFkL1dyaXRlIENhcGFjaXR5JyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgdGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgdGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnQ2FwYWNpdHkgVW5pdHMnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHJlYWRXcml0ZVdpZGdldCk7XG5cbiAgICBjb25zdCB0aHJvdHRsaW5nV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIFRocm90dGxpbmcnLFxuICAgICAgbGVmdDogW1xuICAgICAgICB0YWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgbGFiZWw6ICdUaHJvdHRsZWQgUmVxdWVzdHMnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHRocm90dGxpbmdXaWRnZXQpO1xuXG4gICAgY29uc3QgaXRlbUNvdW50V2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIEl0ZW0gQ291bnQnLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0l0ZW1Db3VudCcsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDogeyBUYWJsZU5hbWU6IHRhYmxlLnRhYmxlTmFtZSB9LFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ0l0ZW0gQ291bnQnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGl0ZW1Db3VudFdpZGdldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVMzRGFzaGJvYXJkcyhidWNrZXRzOiBzMy5CdWNrZXRbXSkge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnUzNEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnR3ltQ29hY2gtQUktUzMtTWV0cmljcycsXG4gICAgfSk7XG5cbiAgICBidWNrZXRzLmZvckVhY2goKGJ1Y2tldCwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IGAke2J1Y2tldC5idWNrZXROYW1lfSAtIFN0b3JhZ2UgJiBSZXF1ZXN0c2AsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdCdWNrZXRTaXplQnl0ZXMnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBCdWNrZXROYW1lOiBidWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgICAgU3RvcmFnZVR5cGU6ICdTdGFuZGFyZFN0b3JhZ2UnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9TMycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnTnVtYmVyT2ZPYmplY3RzJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgQnVja2V0TmFtZTogYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICAgIFN0b3JhZ2VUeXBlOiAnQWxsU3RvcmFnZVR5cGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ1N0b3JhZ2UgKEJ5dGVzKScsXG4gICAgICAgIH0sXG4gICAgICAgIHJpZ2h0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ09iamVjdCBDb3VudCcsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHdpZGdldCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwcGxpY2F0aW9uRGFzaGJvYXJkcygpIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0FwcGxpY2F0aW9uRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0d5bUNvYWNoLUFJLUFwcGxpY2F0aW9uLU1ldHJpY3MnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3VzdG9tIGFwcGxpY2F0aW9uIG1ldHJpY3NcbiAgICBjb25zdCBjdXN0b21NZXRyaWNzV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdDdXN0b20gQXBwbGljYXRpb24gTWV0cmljcycsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1VzZXJSZWdpc3RyYXRpb25zJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdXb3Jrb3V0U2Vzc2lvbnMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnQ291bnQnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGN1c3RvbU1ldHJpY3NXaWRnZXQpO1xuXG4gICAgY29uc3QgZXJyb3JSYXRlV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdFcnJvciBSYXRlIGJ5IFNlcnZpY2UnLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFcnJvclJhdGUnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ0Vycm9yIFJhdGUgKCUpJyxcbiAgICAgIH0sXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhlcnJvclJhdGVXaWRnZXQpO1xuXG4gICAgLy8gQUkgU2VydmljZSBzcGVjaWZpYyBtZXRyaWNzXG4gICAgdGhpcy5jcmVhdGVBSVNlcnZpY2VEYXNoYm9hcmRzKGRhc2hib2FyZCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFJU2VydmljZURhc2hib2FyZHMoZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZCkge1xuICAgIC8vIEFJIENoYXQgTWV0cmljc1xuICAgIGNvbnN0IGFpQ2hhdFdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnQUkgQ2hhdCBTZXJ2aWNlIE1ldHJpY3MnLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUkvQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdDaGF0UmVxdWVzdHMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSS9BSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0NoYXRFcnJvcnMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnQ291bnQnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGFpQ2hhdFdpZGdldCk7XG5cbiAgICAvLyBCZWRyb2NrIFRva2VuIFVzYWdlXG4gICAgY29uc3QgdG9rZW5Vc2FnZVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnQmVkcm9jayBUb2tlbiBVc2FnZScsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSS9BSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0lucHV0VG9rZW5zJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUkvQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdPdXRwdXRUb2tlbnMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnVG9rZW5zJyxcbiAgICAgIH0sXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyh0b2tlblVzYWdlV2lkZ2V0KTtcblxuICAgIC8vIFJhdGUgTGltaXRpbmcgTWV0cmljc1xuICAgIGNvbnN0IHJhdGVMaW1pdFdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnUmF0ZSBMaW1pdGluZyAmIFVzYWdlJyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJL0FJJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnUmF0ZUxpbWl0SGl0cycsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJL0FJJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnRGFpbHlVc2FnZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ0NvdW50JyxcbiAgICAgIH0sXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhyYXRlTGltaXRXaWRnZXQpO1xuXG4gICAgLy8gQ29zdCBFc3RpbWF0aW9uXG4gICAgY29uc3QgY29zdFdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnRXN0aW1hdGVkIEFJIFNlcnZpY2UgQ29zdHMgKFVTRCknLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUkvQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFc3RpbWF0ZWRDb3N0JyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgbGFiZWw6ICdDb3N0IChVU0QpJyxcbiAgICAgIH0sXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhjb3N0V2lkZ2V0KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhQWxhcm1zKGZ1bmN0aW9uczogbGFtYmRhLkZ1bmN0aW9uW10pIHtcbiAgICBmdW5jdGlvbnMuZm9yRWFjaCgoZnVuYykgPT4ge1xuICAgICAgLy8gSGlnaCBlcnJvciByYXRlIGFsYXJtXG4gICAgICBjb25zdCBlcnJvclJhdGVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgJHtmdW5jLmZ1bmN0aW9uTmFtZX1FcnJvclJhdGVBbGFybWAsXG4gICAgICAgIHtcbiAgICAgICAgICBhbGFybU5hbWU6IGAke2Z1bmMuZnVuY3Rpb25OYW1lfS1IaWdoLUVycm9yLVJhdGVgLFxuICAgICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNFcnJvcnMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgZXJyb3JSYXRlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICAgICk7XG5cbiAgICAgIC8vIEhpZ2ggZHVyYXRpb24gYWxhcm1cbiAgICAgIGNvbnN0IGR1cmF0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYCR7ZnVuYy5mdW5jdGlvbk5hbWV9RHVyYXRpb25BbGFybWAsXG4gICAgICAgIHtcbiAgICAgICAgICBhbGFybU5hbWU6IGAke2Z1bmMuZnVuY3Rpb25OYW1lfS1IaWdoLUR1cmF0aW9uYCxcbiAgICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljRHVyYXRpb24oe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHRocmVzaG9sZDogMjUwMDAsIC8vIDI1IHNlY29uZHNcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgZHVyYXRpb25BbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICAgKTtcblxuICAgICAgLy8gSGlnaCBtZW1vcnkgdXRpbGl6YXRpb24gYWxhcm1cbiAgICAgIGNvbnN0IG1lbW9yeUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGAke2Z1bmMuZnVuY3Rpb25OYW1lfU1lbW9yeUFsYXJtYCxcbiAgICAgICAge1xuICAgICAgICAgIGFsYXJtTmFtZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9LUhpZ2gtTWVtb3J5LVVzYWdlYCxcbiAgICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdNYXhNZW1vcnlVc2VkJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRnVuY3Rpb25OYW1lOiBmdW5jLmZ1bmN0aW9uTmFtZSB9LFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHRocmVzaG9sZDogODAsIC8vIDgwJVxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBtZW1vcnlBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICAgKTtcblxuICAgICAgLy8gVGhyb3R0bGluZyBhbGFybVxuICAgICAgY29uc3QgdGhyb3R0bGluZ0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGAke2Z1bmMuZnVuY3Rpb25OYW1lfVRocm90dGxpbmdBbGFybWAsXG4gICAgICAgIHtcbiAgICAgICAgICBhbGFybU5hbWU6IGAke2Z1bmMuZnVuY3Rpb25OYW1lfS1UaHJvdHRsaW5nYCxcbiAgICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljVGhyb3R0bGVzKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHRocmVzaG9sZDogNSxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgdGhyb3R0bGluZ0FsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEYXRhYmFzZUFsYXJtcyh0YWJsZTogZHluYW1vZGIuVGFibGUpIHtcbiAgICAvLyBIaWdoIHJlYWQgY2FwYWNpdHkgYWxhcm1cbiAgICBjb25zdCByZWFkQ2FwYWNpdHlBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgICdEeW5hbW9EQlJlYWRDYXBhY2l0eUFsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiAnRHluYW1vREItSGlnaC1SZWFkLUNhcGFjaXR5JyxcbiAgICAgICAgbWV0cmljOiB0YWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDEwMDAsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgcmVhZENhcGFjaXR5QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcblxuICAgIC8vIEhpZ2ggd3JpdGUgY2FwYWNpdHkgYWxhcm1cbiAgICBjb25zdCB3cml0ZUNhcGFjaXR5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnRHluYW1vREJXcml0ZUNhcGFjaXR5QWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6ICdEeW5hbW9EQi1IaWdoLVdyaXRlLUNhcGFjaXR5JyxcbiAgICAgICAgbWV0cmljOiB0YWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxMDAwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHdyaXRlQ2FwYWNpdHlBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICApO1xuXG4gICAgLy8gVGhyb3R0bGluZyBhbGFybVxuICAgIGNvbnN0IHRocm90dGxpbmdBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgICdEeW5hbW9EQlRocm90dGxpbmdBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogJ0R5bmFtb0RCLVRocm90dGxpbmcnLFxuICAgICAgICBtZXRyaWM6IHRhYmxlLm1ldHJpY1Rocm90dGxlZFJlcXVlc3RzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHRocm90dGxpbmdBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTM0FsYXJtcyhidWNrZXRzOiBzMy5CdWNrZXRbXSkge1xuICAgIGJ1Y2tldHMuZm9yRWFjaCgoYnVja2V0LCBpbmRleCkgPT4ge1xuICAgICAgLy8gSGlnaCBzdG9yYWdlIHVzYWdlIGFsYXJtXG4gICAgICBjb25zdCBzdG9yYWdlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYCR7YnVja2V0LmJ1Y2tldE5hbWV9U3RvcmFnZUFsYXJtYCxcbiAgICAgICAge1xuICAgICAgICAgIGFsYXJtTmFtZTogYCR7YnVja2V0LmJ1Y2tldE5hbWV9LUhpZ2gtU3RvcmFnZS1Vc2FnZWAsXG4gICAgICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdCdWNrZXRTaXplQnl0ZXMnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBCdWNrZXROYW1lOiBidWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgICAgU3RvcmFnZVR5cGU6ICdTdGFuZGFyZFN0b3JhZ2UnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiAxMDAwMDAwMDAwLCAvLyAxR0JcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgc3RvcmFnZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBcHBsaWNhdGlvbkFsYXJtcygpIHtcbiAgICAvLyBIaWdoIGVycm9yIHJhdGUgYWxhcm1cbiAgICBjb25zdCBlcnJvclJhdGVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgICdBcHBsaWNhdGlvbkVycm9yUmF0ZUFsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiAnQXBwbGljYXRpb24tSGlnaC1FcnJvci1SYXRlJyxcbiAgICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFcnJvclJhdGUnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDUsIC8vIDUlXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZXJyb3JSYXRlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcblxuICAgIC8vIExvdyB1c2VyIGFjdGl2aXR5IGFsYXJtXG4gICAgY29uc3QgdXNlckFjdGl2aXR5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnVXNlckFjdGl2aXR5QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdBcHBsaWNhdGlvbi1Mb3ctVXNlci1BY3Rpdml0eScsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlVXNlcnMnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5CUkVBQ0hJTkcsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkxFU1NfVEhBTl9USFJFU0hPTEQsXG4gICAgfSk7XG5cbiAgICB1c2VyQWN0aXZpdHlBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICApO1xuXG4gICAgLy8gQUkgU2VydmljZSBzcGVjaWZpYyBhbGFybXNcbiAgICB0aGlzLmNyZWF0ZUFJU2VydmljZUFsYXJtcygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBSVNlcnZpY2VBbGFybXMoKSB7XG4gICAgLy8gSGlnaCBBSSBzZXJ2aWNlIGNvc3QgYWxhcm1cbiAgICBjb25zdCBhaUNvc3RBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBSVNlcnZpY2VDb3N0QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdBSS1TZXJ2aWNlLUhpZ2gtQ29zdCcsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUkvQUknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRXN0aW1hdGVkQ29zdCcsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsIC8vICQ1IHBlciBob3VyXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgYWlDb3N0QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcblxuICAgIC8vIEhpZ2ggdG9rZW4gdXNhZ2UgYWxhcm1cbiAgICBjb25zdCB0b2tlblVzYWdlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQUlUb2tlblVzYWdlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6ICdBSS1TZXJ2aWNlLUhpZ2gtVG9rZW4tVXNhZ2UnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJL0FJJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0lucHV0VG9rZW5zJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxMDAwMDAsIC8vIDEwMGsgdG9rZW5zIHBlciA1IG1pbnV0ZXNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICB0b2tlblVzYWdlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcblxuICAgIC8vIEhpZ2ggcmF0ZSBsaW1pdCBoaXRzIGFsYXJtXG4gICAgY29uc3QgcmF0ZUxpbWl0QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQUlSYXRlTGltaXRBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ0FJLVNlcnZpY2UtSGlnaC1SYXRlLUxpbWl0LUhpdHMnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJL0FJJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1JhdGVMaW1pdEhpdHMnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwLCAvLyAxMCByYXRlIGxpbWl0IGhpdHMgcGVyIDUgbWludXRlc1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIHJhdGVMaW1pdEFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG5cbiAgICAvLyBBSSBzZXJ2aWNlIGVycm9yIHJhdGUgYWxhcm1cbiAgICBjb25zdCBhaUVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQUlTZXJ2aWNlRXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ0FJLVNlcnZpY2UtSGlnaC1FcnJvci1SYXRlJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSS9BSScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDaGF0RXJyb3JzJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA1LCAvLyA1IGVycm9ycyBwZXIgNSBtaW51dGVzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgYWlFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG4gIH1cbn1cbiJdfQ==