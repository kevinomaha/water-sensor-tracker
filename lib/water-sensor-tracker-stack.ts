import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { EnvironmentConfig } from '../config/environment-config';

interface WaterSensorTrackerStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class WaterSensorTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WaterSensorTrackerStackProps) {
    super(scope, id, props);

    const { environment, apiDescription, retentionDays, isProd, envName } = props.environmentConfig;

    // DynamoDB table for sensor readings
    const sensorTable = new dynamodb.Table(this, 'SensorReadings', {
      partitionKey: { name: 'sensorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // S3 bucket for archiving sensor data
    const archiveBucket = new s3.Bucket(this, 'SensorArchive', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(isProd ? 90 : 30),
            }
          ]
        }
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for processing sensor data
    const processorFunction = new lambda.Function(this, 'SensorProcessor', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'sensor_processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      environment: {
        TABLE_NAME: sensorTable.tableName,
        BUCKET_NAME: archiveBucket.bucketName,
        ENVIRONMENT: envName
      }
    });

    // Grant permissions
    sensorTable.grantReadWriteData(processorFunction);
    archiveBucket.grantReadWrite(processorFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'WaterSensorApi', {
      restApiName: `Water Sensor API - ${envName}`,
      description: apiDescription,
      deployOptions: {
        stageName: envName,
        tracingEnabled: true,
        methodOptions: {
          '/*/*': {
            dataTraceEnabled: !isProd,
            metricsEnabled: true,
            loggingLevel: isProd ? apigateway.MethodLoggingLevel.ERROR : apigateway.MethodLoggingLevel.INFO,
          },
        },
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      },
    });

    // API resources and methods
    const sensors = api.root.addResource('sensors');
    
    // POST /sensors (ingest sensor data)
    sensors.addMethod('POST', new apigateway.LambdaIntegration(processorFunction));
    
    // GET /sensors/{sensorId}
    const sensor = sensors.addResource('{sensorId}');
    sensor.addMethod('GET', new apigateway.LambdaIntegration(processorFunction));

    // Add stack outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: `${envName} API Gateway endpoint URL`
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: sensorTable.tableName,
      description: `${envName} DynamoDB table name`
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: archiveBucket.bucketName,
      description: `${envName} S3 archive bucket name`
    });
  }
}
