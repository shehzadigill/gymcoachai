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
                    func.metricMemoryUtilization({
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
                table.metricItemCount({
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
                    bucket.metricBucketSizeBytes({
                        period: cdk.Duration.hours(1),
                        statistic: 'Average',
                    }),
                ],
                right: [
                    bucket.metricNumberOfObjects({
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
                metric: func.metricMemoryUtilization({
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
                metric: bucket.metricBucketSizeBytes({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tb25pdG9yaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5REFBeUQ7QUFDekQseUVBQXlFO0FBQ3pFLDJDQUEyQztBQWEzQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFdBQVcsRUFBRSxvQkFBb0I7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBRW5DLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLHNCQUFzQixDQUFDLFNBQTRCO1FBQ3pELE1BQU0s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QUM1RCxDQUNGLENBQUM7UUFFRixjQUFjLENBQUMsY0FBYyxDQUMzQixJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQ2xELENBQUM7UUFFRiwwQkFBMEI7UUFDMUIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3hFLFNBQVMsRUFBRSwrQkFBK0I7WUFDMUMsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLFlBQVk7Z0JBQ3ZCLFVBQVUsRUFBRSxhQUFhO2dCQUN6QixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixTQUFTLEVBQUUsU0FBUzthQUNyQixDQUFDO1lBQ0YsU0FBUyxFQUFFLEVBQUU7WUFDYixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTO1lBQ3ZELGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUI7U0FDdEUsQ0FBQyxDQUFDO1FBRUgsaUJBQWlCLENBQUMsY0FBYyxDQUM5QixJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQ2xELENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFyY0QsMENBcWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1vbml0b3JpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdO1xuICBkeW5hbW9EYlRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgczNCdWNrZXRzOiBzMy5CdWNrZXRbXTtcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhbGFybVRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBhbGVydHNcbiAgICB0aGlzLmFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGFybVRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiAnZ3ltY29hY2gtYWktYWxhcm1zJyxcbiAgICAgIGRpc3BsYXlOYW1lOiAnR3ltQ29hY2ggQUkgQWxhcm1zJyxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIGRhc2hib2FyZHNcbiAgICB0aGlzLmNyZWF0ZUxhbWJkYURhc2hib2FyZHMocHJvcHMubGFtYmRhRnVuY3Rpb25zKTtcbiAgICB0aGlzLmNyZWF0ZURhdGFiYXNlRGFzaGJvYXJkcyhwcm9wcy5keW5hbW9EYlRhYmxlKTtcbiAgICB0aGlzLmNyZWF0ZVMzRGFzaGJvYXJkcyhwcm9wcy5zM0J1Y2tldHMpO1xuICAgIHRoaXMuY3JlYXRlQXBwbGljYXRpb25EYXNoYm9hcmRzKCk7XG5cbiAgICAvLyBDcmVhdGUgYWxhcm1zXG4gICAgdGhpcy5jcmVhdGVMYW1iZGFBbGFybXMocHJvcHMubGFtYmRhRnVuY3Rpb25zKTtcbiAgICB0aGlzLmNyZWF0ZURhdGFiYXNlQWxhcm1zKHByb3BzLmR5bmFtb0RiVGFibGUpO1xuICAgIHRoaXMuY3JlYXRlUzNBbGFybXMocHJvcHMuczNCdWNrZXRzKTtcbiAgICB0aGlzLmNyZWF0ZUFwcGxpY2F0aW9uQWxhcm1zKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUxhbWJkYURhc2hib2FyZHMoZnVuY3Rpb25zOiBsYW1iZGEuRnVuY3Rpb25bXSkge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnTGFtYmRhRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0d5bUNvYWNoLUFJLUxhbWJkYS1NZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgd2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gSW52b2NhdGlvbnMgJiBFcnJvcnNgLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgZnVuYy5tZXRyaWNJbnZvY2F0aW9ucyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBmdW5jLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbGFiZWw6ICdDb3VudCcsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHdpZGdldCk7XG5cbiAgICAgIGNvbnN0IGR1cmF0aW9uV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gRHVyYXRpb24gJiBUaHJvdHRsZXNgLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgZnVuYy5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgZnVuYy5tZXRyaWNUaHJvdHRsZXMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAnRHVyYXRpb24gKG1zKScsXG4gICAgICAgIH0sXG4gICAgICAgIHJpZ2h0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ1Rocm90dGxlcycsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGR1cmF0aW9uV2lkZ2V0KTtcblxuICAgICAgY29uc3QgbWVtb3J5V2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9IC0gTWVtb3J5IFVzYWdlYCxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIGZ1bmMubWV0cmljTWVtb3J5VXRpbGl6YXRpb24oe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ01lbW9yeSBVdGlsaXphdGlvbiAoJSknLFxuICAgICAgICB9LFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pO1xuXG4gICAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhtZW1vcnlXaWRnZXQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEYXRhYmFzZURhc2hib2FyZHModGFibGU6IGR5bmFtb2RiLlRhYmxlKSB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXRhYmFzZURhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdHeW1Db2FjaC1BSS1EYXRhYmFzZS1NZXRyaWNzJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlYWRXcml0ZVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnRHluYW1vREIgLSBSZWFkL1dyaXRlIENhcGFjaXR5JyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgdGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgdGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnQ2FwYWNpdHkgVW5pdHMnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHJlYWRXcml0ZVdpZGdldCk7XG5cbiAgICBjb25zdCB0aHJvdHRsaW5nV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIFRocm90dGxpbmcnLFxuICAgICAgbGVmdDogW1xuICAgICAgICB0YWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgbGFiZWw6ICdUaHJvdHRsZWQgUmVxdWVzdHMnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHRocm90dGxpbmdXaWRnZXQpO1xuXG4gICAgY29uc3QgaXRlbUNvdW50V2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdEeW5hbW9EQiAtIEl0ZW0gQ291bnQnLFxuICAgICAgbGVmdDogW1xuICAgICAgICB0YWJsZS5tZXRyaWNJdGVtQ291bnQoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ0l0ZW0gQ291bnQnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGl0ZW1Db3VudFdpZGdldCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVMzRGFzaGJvYXJkcyhidWNrZXRzOiBzMy5CdWNrZXRbXSkge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnUzNEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnR3ltQ29hY2gtQUktUzMtTWV0cmljcycsXG4gICAgfSk7XG5cbiAgICBidWNrZXRzLmZvckVhY2goKGJ1Y2tldCwgaW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IHdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IGAke2J1Y2tldC5idWNrZXROYW1lfSAtIFN0b3JhZ2UgJiBSZXF1ZXN0c2AsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBidWNrZXQubWV0cmljQnVja2V0U2l6ZUJ5dGVzKHtcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgYnVja2V0Lm1ldHJpY051bWJlck9mT2JqZWN0cyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ1N0b3JhZ2UgKEJ5dGVzKScsXG4gICAgICAgIH0sXG4gICAgICAgIHJpZ2h0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ09iamVjdCBDb3VudCcsXG4gICAgICAgIH0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSk7XG5cbiAgICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKHdpZGdldCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwcGxpY2F0aW9uRGFzaGJvYXJkcygpIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0FwcGxpY2F0aW9uRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0d5bUNvYWNoLUFJLUFwcGxpY2F0aW9uLU1ldHJpY3MnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3VzdG9tIGFwcGxpY2F0aW9uIG1ldHJpY3NcbiAgICBjb25zdCBjdXN0b21NZXRyaWNzV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdDdXN0b20gQXBwbGljYXRpb24gTWV0cmljcycsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1VzZXJSZWdpc3RyYXRpb25zJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdXb3Jrb3V0U2Vzc2lvbnMnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgIGxhYmVsOiAnQ291bnQnLFxuICAgICAgfSxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKGN1c3RvbU1ldHJpY3NXaWRnZXQpO1xuXG4gICAgY29uc3QgZXJyb3JSYXRlV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdFcnJvciBSYXRlIGJ5IFNlcnZpY2UnLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0d5bUNvYWNoQUknLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFcnJvclJhdGUnLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICBsYWJlbDogJ0Vycm9yIFJhdGUgKCUpJyxcbiAgICAgIH0sXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgfSk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhlcnJvclJhdGVXaWRnZXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFBbGFybXMoZnVuY3Rpb25zOiBsYW1iZGEuRnVuY3Rpb25bXSkge1xuICAgIGZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jKSA9PiB7XG4gICAgICAvLyBIaWdoIGVycm9yIHJhdGUgYWxhcm1cbiAgICAgIGNvbnN0IGVycm9yUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGAke2Z1bmMuZnVuY3Rpb25OYW1lfUVycm9yUmF0ZUFsYXJtYCxcbiAgICAgICAge1xuICAgICAgICAgIGFsYXJtTmFtZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9LUhpZ2gtRXJyb3ItUmF0ZWAsXG4gICAgICAgICAgbWV0cmljOiBmdW5jLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDEwLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBlcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICAgKTtcblxuICAgICAgLy8gSGlnaCBkdXJhdGlvbiBhbGFybVxuICAgICAgY29uc3QgZHVyYXRpb25BbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgJHtmdW5jLmZ1bmN0aW9uTmFtZX1EdXJhdGlvbkFsYXJtYCxcbiAgICAgICAge1xuICAgICAgICAgIGFsYXJtTmFtZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9LUhpZ2gtRHVyYXRpb25gLFxuICAgICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiAyNTAwMCwgLy8gMjUgc2Vjb25kc1xuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBkdXJhdGlvbkFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgICApO1xuXG4gICAgICAvLyBIaWdoIG1lbW9yeSB1dGlsaXphdGlvbiBhbGFybVxuICAgICAgY29uc3QgbWVtb3J5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYCR7ZnVuYy5mdW5jdGlvbk5hbWV9TWVtb3J5QWxhcm1gLFxuICAgICAgICB7XG4gICAgICAgICAgYWxhcm1OYW1lOiBgJHtmdW5jLmZ1bmN0aW9uTmFtZX0tSGlnaC1NZW1vcnktVXNhZ2VgLFxuICAgICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNNZW1vcnlVdGlsaXphdGlvbih7XG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiA4MCwgLy8gODAlXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIG1lbW9yeUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpXG4gICAgICApO1xuXG4gICAgICAvLyBUaHJvdHRsaW5nIGFsYXJtXG4gICAgICBjb25zdCB0aHJvdHRsaW5nQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYCR7ZnVuYy5mdW5jdGlvbk5hbWV9VGhyb3R0bGluZ0FsYXJtYCxcbiAgICAgICAge1xuICAgICAgICAgIGFsYXJtTmFtZTogYCR7ZnVuYy5mdW5jdGlvbk5hbWV9LVRocm90dGxpbmdgLFxuICAgICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNUaHJvdHRsZXMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICB0aHJvdHRsaW5nQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURhdGFiYXNlQWxhcm1zKHRhYmxlOiBkeW5hbW9kYi5UYWJsZSkge1xuICAgIC8vIEhpZ2ggcmVhZCBjYXBhY2l0eSBhbGFybVxuICAgIGNvbnN0IHJlYWRDYXBhY2l0eUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ0R5bmFtb0RCUmVhZENhcGFjaXR5QWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6ICdEeW5hbW9EQi1IaWdoLVJlYWQtQ2FwYWNpdHknLFxuICAgICAgICBtZXRyaWM6IHRhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMTAwMCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICByZWFkQ2FwYWNpdHlBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICApO1xuXG4gICAgLy8gSGlnaCB3cml0ZSBjYXBhY2l0eSBhbGFybVxuICAgIGNvbnN0IHdyaXRlQ2FwYWNpdHlBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgICdEeW5hbW9EQldyaXRlQ2FwYWNpdHlBbGFybScsXG4gICAgICB7XG4gICAgICAgIGFsYXJtTmFtZTogJ0R5bmFtb0RCLUhpZ2gtV3JpdGUtQ2FwYWNpdHknLFxuICAgICAgICBtZXRyaWM6IHRhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHtcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDEwMDAsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgd3JpdGVDYXBhY2l0eUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG5cbiAgICAvLyBUaHJvdHRsaW5nIGFsYXJtXG4gICAgY29uc3QgdGhyb3R0bGluZ0FsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ0R5bmFtb0RCVGhyb3R0bGluZ0FsYXJtJyxcbiAgICAgIHtcbiAgICAgICAgYWxhcm1OYW1lOiAnRHluYW1vREItVGhyb3R0bGluZycsXG4gICAgICAgIG1ldHJpYzogdGFibGUubWV0cmljVGhyb3R0bGVkUmVxdWVzdHMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhyb3R0bGluZ0FsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVMzQWxhcm1zKGJ1Y2tldHM6IHMzLkJ1Y2tldFtdKSB7XG4gICAgYnVja2V0cy5mb3JFYWNoKChidWNrZXQsIGluZGV4KSA9PiB7XG4gICAgICAvLyBIaWdoIHN0b3JhZ2UgdXNhZ2UgYWxhcm1cbiAgICAgIGNvbnN0IHN0b3JhZ2VBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgJHtidWNrZXQuYnVja2V0TmFtZX1TdG9yYWdlQWxhcm1gLFxuICAgICAgICB7XG4gICAgICAgICAgYWxhcm1OYW1lOiBgJHtidWNrZXQuYnVja2V0TmFtZX0tSGlnaC1TdG9yYWdlLVVzYWdlYCxcbiAgICAgICAgICBtZXRyaWM6IGJ1Y2tldC5tZXRyaWNCdWNrZXRTaXplQnl0ZXMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDEwMDAwMDAwMDAsIC8vIDFHQlxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBzdG9yYWdlQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwcGxpY2F0aW9uQWxhcm1zKCkge1xuICAgIC8vIEhpZ2ggZXJyb3IgcmF0ZSBhbGFybVxuICAgIGNvbnN0IGVycm9yUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgJ0FwcGxpY2F0aW9uRXJyb3JSYXRlQWxhcm0nLFxuICAgICAge1xuICAgICAgICBhbGFybU5hbWU6ICdBcHBsaWNhdGlvbi1IaWdoLUVycm9yLVJhdGUnLFxuICAgICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9yUmF0ZScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogNSwgLy8gNSVcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBlcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYylcbiAgICApO1xuXG4gICAgLy8gTG93IHVzZXIgYWN0aXZpdHkgYWxhcm1cbiAgICBjb25zdCB1c2VyQWN0aXZpdHlBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdVc2VyQWN0aXZpdHlBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ0FwcGxpY2F0aW9uLUxvdy1Vc2VyLUFjdGl2aXR5JyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnR3ltQ29hY2hBSScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdBY3RpdmVVc2VycycsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLkJSRUFDSElORyxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICB9KTtcblxuICAgIHVzZXJBY3Rpdml0eUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKVxuICAgICk7XG4gIH1cbn1cbiJdfQ==