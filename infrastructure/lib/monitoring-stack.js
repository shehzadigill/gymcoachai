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
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tb25pdG9yaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5REFBeUQ7QUFDekQseUVBQXlFO0FBQ3pFLDJDQUEyQztBQWEzQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFdBQVcsRUFBRSxvQkFBb0I7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBRW5DLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLHNCQUFzQixDQUFDLFNBQTRCO1FBQ3pELE1BQU0s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SUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsWUFBWTtnQkFDdkIsVUFBVSxFQUFFLGFBQWE7Z0JBQ3pCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLFNBQVMsRUFBRSxTQUFTO2FBQ3JCLENBQUM7WUFDRixTQUFTLEVBQUUsRUFBRTtZQUNiLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFNBQVM7WUFDdkQsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLG1CQUFtQjtTQUN0RSxDQUFDLENBQUM7UUFFSCxpQkFBaUIsQ0FBQyxjQUFjLENBQzlCLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FDbEQsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWhlRCwwQ0FnZUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoX2FjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9uaXRvcmluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGxhbWJkYUZ1bmN0aW9uczogbGFtYmRhLkZ1bmN0aW9uW107XG4gIGR5bmFtb0RiVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBzM0J1Y2tldHM6IHMzLkJ1Y2tldFtdO1xufVxuXG5leHBvcnQgY2xhc3MgTW9uaXRvcmluZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFsYXJtVG9waWM6IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBTTlMgdG9waWMgZm9yIGFsZXJ0c1xuICAgIHRoaXMuYWxhcm1Ub3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FsYXJtVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6ICdneW1jb2FjaC1haS1hbGFybXMnLFxuICAgICAgZGlzcGxheU5hbWU6ICdHeW1Db2FjaCBBSSBBbGFybXMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggZGFzaGJvYXJkc1xuICAgIHRoaXMuY3JlYXRlTGFtYmRhRGFzaGJvYXJkcyhwcm9wcy5sYW1iZGFGdW5jdGlvbnMpO1xuICAgIHRoaXMuY3JlYXRlRGF0YWJhc2VEYXNoYm9hcmRzKHByb3BzLmR5bmFtb0RiVGFibGUpO1xuICAgIHRoaXMuY3JlYXRlUzNEYXNoYm9hcmRzKHByb3BzLnMzQnVja2V0cyk7XG4gICAgdGhpcy5jcmVhdGVBcHBsaWNhdGlvbkRhc2hib2FyZHMoKTtcblxuICAgIC8vIENyZWF0ZSBhbGFybXNcbiAgICB0aGlzLmNyZWF0ZUxhbWJkYUFsYXJtcyhwcm9wcy5sYW1iZGFGdW5jdGlvbnMpO1xuICAgIHRoaXMuY3JlYXRlRGF0YWJhc2VBbGFybXMocHJvcHMuZHluYW1vRGJUYWJsZSk7XG4gICAgdGhpcy5jcmVhdGVTM0FsYXJtcyhwcm9wcy5zM0J1Y2tldHMpO1xuICAgIHRoaXMuY3JlYXRlQXBwbGljYXRpb25BbGFybXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRGFzaGJvYXJkcyhmdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdMYW1iZGFEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnR3ltQ29hY2gtQUktTGFtYmRhLU1ldHJpY3MnLFxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb25zLmZvckVhY2goKGZ1bmMsIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCB3aWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0gLSBJbnZvY2F0aW9ucyAmIEVycm9yc2AsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBmdW5jLm1ldHJpY0ludm9jYXRpb25zKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGZ1bmMubWV0cmljRXJyb3JzKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ0NvdW50JyxcbiAgICAgICAgfSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KTtcblxuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMod2lkZ2V0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb25XaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0gLSBEdXJhdGlvbiAmIFRocm90dGxlc2AsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBmdW5jLm1ldHJpY0R1cmF0aW9uKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBmdW5jLm1ldHJpY1Rocm90dGxlcyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbGFiZWw6ICdEdXJhdGlvbiAobXMpJyxcbiAgICAgICAgfSxcbiAgICAgICAgcmlnaHRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnVGhyb3R0bGVzJyxcbiAgICAgICAgfSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KTtcblxuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoZHVyYXRpb25XaWRnZXQpO1xuXG4gICAgICBjb25zdCBtZW1vcnlXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0gLSBNZW1vcnkgVXNhZ2VgLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ01heE1lbW9yeVVzZWQnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBGdW5jdGlvbk5hbWU6IGZ1bmMuZnVuY3Rpb25OYW1lIH0sXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnTWVtb3J5IFV0aWxpemF0aW9uICglKScsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKG1lbW9yeVdpZGdldCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURhdGFiYXNlRGFzaGJvYXJkcyh0YWJsZTogZHluYW1vZGIuVGFibGUpIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0RhdGFiYXNlRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0d5bUNvYWNoLUFJLURhdGFiYXNlLU1ldHJpY3MnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVhZFdyaXRlV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIFJlYWQvV3JpdGUgQ2FwYWNpdHknLFxuICAgICAgbGVmdDogW1xuICAgICAgICB0YWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICB0YWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgbGFiZWw6ICdDYXBhY2l0eSBVbml0cycsXG4gICAgICB9LFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMocmVhZFdyaXRlV2lkZ2V0KTtcblxuICAgIGNvbnN0IHRocm90dGxpbmdXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0R5bmFtb0RCIC0gVGhyb3R0bGluZycsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIHRhYmxlLm1ldHJpY1Rocm90dGxlZFJlcXVlc3RzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ1Rocm90dGxlZCBSZXF1ZXN0cycsXG4gICAgICB9LFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHModGhyb3R0bGluZ1dpZGdldCk7XG5cbiAgICBjb25zdCBpdGVtQ291bnRXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0R5bmFtb0RCIC0gSXRlbSBDb3VudCcsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnSXRlbUNvdW50JyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFRhYmxlTmFtZTogdGFibGUudGFibGVOYW1lIH0sXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnSXRlbSBDb3VudCcsXG4gICAgICB9LFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoaXRlbUNvdW50V2lkZ2V0KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUzNEYXNoYm9hcmRzKGJ1Y2tldHM6IHMzLkJ1Y2tldFtdKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdTM0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdHeW1Db2FjaC1BSS1TMy1NZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIGJ1Y2tldHMuZm9yRWFjaCgoYnVja2V0LCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgd2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7YnVja2V0LmJ1Y2tldE5hbWV9IC0gU3RvcmFnZSAmIFJlcXVlc3RzYCxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvUzMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0J1Y2tldFNpemVCeXRlcycsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgIEJ1Y2tldE5hbWU6IGJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgICAgICBTdG9yYWdlVHlwZTogJ1N0YW5kYXJkU3RvcmFnZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1MzJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdOdW1iZXJPZk9iamVjdHMnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBCdWNrZXROYW1lOiBidWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgICAgU3RvcmFnZVR5cGU6ICdBbGxTdG9yYWdlVHlwZXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnU3RvcmFnZSAoQnl0ZXMpJyxcbiAgICAgICAgfSxcbiAgICAgICAgcmlnaHRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnT2JqZWN0IENvdW50JyxcbiAgICAgICAgfSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KTtcblxuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMod2lkZ2V0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQXBwbGljYXRpb25EYXNoYm9hcmRzKCkge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnQXBwbGljYXRpb25EYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnR3ltQ29hY2gtQUktQXBwbGljYXRpb24tTWV0cmljcycsXG4gICAgfSk7XG5cbiAgICAvLyBDdXN0b20gYXBwbGljYXRpb24gbWV0cmljc1xuICAgIGNvbnN0IGN1c3RvbU1ldHJpY3NXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0N1c3RvbSBBcHBsaWNhdGlvbiBNZXRyaWNzJyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnVXNlclJlZ2lzdHJhdGlvbnMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1dvcmtvdXRTZXNzaW9ucycsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgbGFiZWw6ICdDb3VudCcsXG4gICAgICB9LFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoY3VzdG9tTWV0cmljc1dpZGdldCk7XG5cbiAgICBjb25zdCBlcnJvclJhdGVXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0Vycm9yIFJhdGUgYnkgU2VydmljZScsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9yUmF0ZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnRXJyb3IgUmF0ZSAoJSknLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGVycm9yUmF0ZVdpZGdldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUFsYXJtcyhmdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdKSB7XG4gICAgZnVuY3Rpb25zLmZvckVhY2goKGZ1bmMpID0+IHtcbiAgICAgIC8vIEhpZ2ggZXJyb3IgcmF0ZSBhbGFybVxuICAgICAgY29uc3QgZXJyb3JSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYCR7ZnVuYy5mdW5jdGlvbk5hbWV9RXJyb3JSYXRlQWxhcm1gLFxuICAgICAgICB7XG4gICAgICAgICAgYWxhcm1OYW1lOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0tSGlnaC1FcnJvci1SYXRlYCxcbiAgICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljRXJyb3JzKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGVycm9yUmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgICApO1xuXG4gICAgICAvLyBIaWdoIGR1cmF0aW9uIGFsYXJtXG4gICAgICBjb25zdCBkdXJhdGlvbkFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGAke2Z1bmMuZnVuY3Rpb25OYW1lfUR1cmF0aW9uQWxhcm1gLFxuICAgICAgICB7XG4gICAgICAgICAgYWxhcm1OYW1lOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0tSGlnaC1EdXJhdGlvbmAsXG4gICAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY0R1cmF0aW9uKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDI1MDAwLCAvLyAyNSBzZWNvbmRzXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGR1cmF0aW9uQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICAgICk7XG5cbiAgICAgIC8vIEhpZ2ggbWVtb3J5IHV0aWxpemF0aW9uIGFsYXJtXG4gICAgICBjb25zdCBtZW1vcnlBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgJHtmdW5jLmZ1bmN0aW9uTmFtZX1NZW1vcnlBbGFybWAsXG4gICAgICAgIHtcbiAgICAgICAgICBhbGFybU5hbWU6IGAke2Z1bmMuZnVuY3Rpb25OYW1lfS1IaWdoLU1lbW9yeS1Vc2FnZWAsXG4gICAgICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnTWF4TWVtb3J5VXNlZCcsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEZ1bmN0aW9uTmFtZTogZnVuYy5mdW5jdGlvbk5hbWUgfSxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDgwLCAvLyA4MCVcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgbWVtb3J5QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICAgICk7XG5cbiAgICAgIC8vIFRocm90dGxpbmcgYWxhcm1cbiAgICAgIGNvbnN0IHRocm90dGxpbmdBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgJHtmdW5jLmZ1bmN0aW9uTmFtZX1UaHJvdHRsaW5nQWxhcm1gLFxuICAgICAgICB7XG4gICAgICAgICAgYWxhcm1OYW1lOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0tVGhyb3R0bGluZ2AsXG4gICAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY1Rocm90dGxlcyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIHRocm90dGxpbmdBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRGF0YWJhc2VBbGFybXModGFibGU6IGR5bmFtb2RiLlRhYmxlKSB7XG4gICAgLy8gSGlnaCByZWFkIGNhcGFjaXR5IGFsYXJtXG4gICAgY29uc3QgcmVhZENhcGFjaXR5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnRHluYW1vREJSZWFkQ2FwYWNpdHlBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogJ0R5bmFtb0RCLUhpZ2gtUmVhZC1DYXBhY2l0eScsXG4gICAgICAgIG1ldHJpYzogdGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxMDAwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIHJlYWRDYXBhY2l0eUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG5cbiAgICAvLyBIaWdoIHdyaXRlIGNhcGFjaXR5IGFsYXJtXG4gICAgY29uc3Qgd3JpdGVDYXBhY2l0eUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ0R5bmFtb0RCV3JpdGVDYXBhY2l0eUFsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiAnRHluYW1vREItSGlnaC1Xcml0ZS1DYXBhY2l0eScsXG4gICAgICAgIG1ldHJpYzogdGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMTAwMCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICB3cml0ZUNhcGFjaXR5QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcblxuICAgIC8vIFRocm90dGxpbmcgYWxhcm1cbiAgICBjb25zdCB0aHJvdHRsaW5nQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnRHluYW1vREJUaHJvdHRsaW5nQWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6ICdEeW5hbW9EQi1UaHJvdHRsaW5nJyxcbiAgICAgICAgbWV0cmljOiB0YWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICB0aHJvdHRsaW5nQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUzNBbGFybXMoYnVja2V0czogczMuQnVja2V0W10pIHtcbiAgICBidWNrZXRzLmZvckVhY2goKGJ1Y2tldCwgaW5kZXgpID0+IHtcbiAgICAgIC8vIEhpZ2ggc3RvcmFnZSB1c2FnZSBhbGFybVxuICAgICAgY29uc3Qgc3RvcmFnZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGAke2J1Y2tldC5idWNrZXROYW1lfVN0b3JhZ2VBbGFybWAsXG4gICAgICAgIHtcbiAgICAgICAgICBhbGFybU5hbWU6IGAke2J1Y2tldC5idWNrZXROYW1lfS1IaWdoLVN0b3JhZ2UtVXNhZ2VgLFxuICAgICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9TMycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQnVja2V0U2l6ZUJ5dGVzJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgQnVja2V0TmFtZTogYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgICAgIFN0b3JhZ2VUeXBlOiAnU3RhbmRhcmRTdG9yYWdlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHRocmVzaG9sZDogMTAwMDAwMDAwMCwgLy8gMUdCXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIHN0b3JhZ2VBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQXBwbGljYXRpb25BbGFybXMoKSB7XG4gICAgLy8gSGlnaCBlcnJvciByYXRlIGFsYXJtXG4gICAgY29uc3QgZXJyb3JSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgIHRoaXMsXG4gICAgICAnQXBwbGljYXRpb25FcnJvclJhdGVBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogJ0FwcGxpY2F0aW9uLUhpZ2gtRXJyb3ItUmF0ZScsXG4gICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JSYXRlJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiA1LCAvLyA1JVxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGVycm9yUmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG5cbiAgICAvLyBMb3cgdXNlciBhY3Rpdml0eSBhbGFybVxuICAgIGNvbnN0IHVzZXJBY3Rpdml0eUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1VzZXJBY3Rpdml0eUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAnQXBwbGljYXRpb24tTG93LVVzZXItQWN0aXZpdHknLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdHeW1Db2FjaEFJJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0FjdGl2ZVVzZXJzJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuQlJFQUNISU5HLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5MRVNTX1RIQU5fVEhSRVNIT0xELFxuICAgIH0pO1xuXG4gICAgdXNlckFjdGl2aXR5QWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgKTtcbiAgfVxufVxuIl19