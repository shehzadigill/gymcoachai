import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  lambdaFunctions: lambda.Function[];
  dynamoDbTable: dynamodb.Table;
  s3Buckets: s3.Bucket[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
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

  private createLambdaDashboards(functions: lambda.Function[]) {
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

  private createDatabaseDashboards(table: dynamodb.Table) {
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

  private createS3Dashboards(buckets: s3.Bucket[]) {
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

  private createApplicationDashboards() {
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

  private createLambdaAlarms(functions: lambda.Function[]) {
    functions.forEach((func) => {
      // High error rate alarm
      const errorRateAlarm = new cloudwatch.Alarm(
        this,
        `${func.functionName}ErrorRateAlarm`,
        {
          alarmName: `${func.functionName}-High-Error-Rate`,
          metric: func.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          threshold: 10,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }
      );

      errorRateAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // High duration alarm
      const durationAlarm = new cloudwatch.Alarm(
        this,
        `${func.functionName}DurationAlarm`,
        {
          alarmName: `${func.functionName}-High-Duration`,
          metric: func.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
          }),
          threshold: 25000, // 25 seconds
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }
      );

      durationAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // High memory utilization alarm
      const memoryAlarm = new cloudwatch.Alarm(
        this,
        `${func.functionName}MemoryAlarm`,
        {
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
        }
      );

      memoryAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alarmTopic)
      );

      // Throttling alarm
      const throttlingAlarm = new cloudwatch.Alarm(
        this,
        `${func.functionName}ThrottlingAlarm`,
        {
          alarmName: `${func.functionName}-Throttling`,
          metric: func.metricThrottles({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          threshold: 5,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }
      );

      throttlingAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alarmTopic)
      );
    });
  }

  private createDatabaseAlarms(table: dynamodb.Table) {
    // High read capacity alarm
    const readCapacityAlarm = new cloudwatch.Alarm(
      this,
      'DynamoDBReadCapacityAlarm',
      {
        alarmName: 'DynamoDB-High-Read-Capacity',
        metric: table.metricConsumedReadCapacityUnits({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1000,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    readCapacityAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alarmTopic)
    );

    // High write capacity alarm
    const writeCapacityAlarm = new cloudwatch.Alarm(
      this,
      'DynamoDBWriteCapacityAlarm',
      {
        alarmName: 'DynamoDB-High-Write-Capacity',
        metric: table.metricConsumedWriteCapacityUnits({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1000,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    writeCapacityAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alarmTopic)
    );

    // Throttling alarm
    const throttlingAlarm = new cloudwatch.Alarm(
      this,
      'DynamoDBThrottlingAlarm',
      {
        alarmName: 'DynamoDB-Throttling',
        metric: table.metricThrottledRequests({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 10,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    throttlingAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alarmTopic)
    );
  }

  private createS3Alarms(buckets: s3.Bucket[]) {
    buckets.forEach((bucket, index) => {
      // High storage usage alarm
      const storageAlarm = new cloudwatch.Alarm(
        this,
        `${bucket.bucketName}StorageAlarm`,
        {
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
        }
      );

      storageAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alarmTopic)
      );
    });
  }

  private createApplicationAlarms() {
    // High error rate alarm
    const errorRateAlarm = new cloudwatch.Alarm(
      this,
      'ApplicationErrorRateAlarm',
      {
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
      }
    );

    errorRateAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alarmTopic)
    );

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

    userActivityAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alarmTopic)
    );
  }
}
