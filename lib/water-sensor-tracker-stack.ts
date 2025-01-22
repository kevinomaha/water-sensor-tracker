import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';

export class WaterSensorTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for sensor readings
    const sensorTable = new dynamodb.Table(this, 'SensorReadings', {
      partitionKey: { name: 'sensorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl'
    });

    // S3 bucket for archiving sensor data
    const archiveBucket = new s3.Bucket(this, 'SensorArchive', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ]
    });

    // Lambda function for processing sensor data
    const processorFunction = new lambda.Function(this, 'SensorProcessor', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'sensor_processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      environment: {
        TABLE_NAME: sensorTable.tableName,
        BUCKET_NAME: archiveBucket.bucketName
      }
    });

    // Grant permissions
    sensorTable.grantReadWriteData(processorFunction);
    archiveBucket.grantReadWrite(processorFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'WaterSensorApi', {
      restApiName: 'Water Sensor API',
      description: 'API for water sensor data ingestion and querying',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
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
      description: 'API Gateway endpoint URL'
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: sensorTable.tableName,
      description: 'DynamoDB table name'
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: archiveBucket.bucketName,
      description: 'S3 archive bucket name'
    });
  }
}
