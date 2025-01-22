import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WaterSensorTrackerStack } from '../../lib/water-sensor-tracker-stack';
import { environments } from '../../config/environment-config';

describe('WaterSensorTrackerStack', () => {
  describe('Development Environment', () => {
    const app = new cdk.App();
    const devStack = new WaterSensorTrackerStack(app, 'WaterSensorTracker-Dev', {
      env: { account: '123456789012', region: 'us-east-1' },
      environmentConfig: environments.dev
    });
    const template = Template.fromStack(devStack);

    it('creates DynamoDB table with dev settings', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        }
      });

      // Dev environment should have DESTROY removal policy
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete'
      });
    });

    it('creates S3 bucket with dev settings', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled'
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 30
                }
              ]
            }
          ]
        }
      });

      // Dev environment should have DESTROY removal policy
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete'
      });
    });

    it('creates API Gateway with dev settings', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Water Sensor API - dev',
        Description: Match.anyValue()
      });

      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'dev',
        TracingEnabled: true,
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            DataTraceEnabled: true,
            LoggingLevel: 'INFO',
            MetricsEnabled: true,
            HttpMethod: '*',
            ResourcePath: '/*'
          })
        ])
      });
    });
  });

  describe('Production Environment', () => {
    const app = new cdk.App();
    const prodStack = new WaterSensorTrackerStack(app, 'WaterSensorTracker-Prod', {
      env: { account: '123456789012', region: 'us-east-1' },
      environmentConfig: environments.prod
    });
    const template = Template.fromStack(prodStack);

    it('creates DynamoDB table with prod settings', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        }
      });

      // Prod environment should have RETAIN removal policy
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain'
      });
    });

    it('creates S3 bucket with prod settings', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled'
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90
                }
              ]
            }
          ]
        }
      });

      // Prod environment should have RETAIN removal policy
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain'
      });
    });

    it('creates API Gateway with prod settings', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Water Sensor API - prod',
        Description: Match.anyValue()
      });

      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
        TracingEnabled: true,
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            DataTraceEnabled: false,
            LoggingLevel: 'ERROR',
            MetricsEnabled: true,
            HttpMethod: '*',
            ResourcePath: '/*'
          })
        ])
      });
    });
  });

  describe('Lambda Function', () => {
    const app = new cdk.App();
    const stack = new WaterSensorTrackerStack(app, 'WaterSensorTracker-Test', {
      env: { account: '123456789012', region: 'us-east-1' },
      environmentConfig: environments.dev
    });
    const template = Template.fromStack(stack);

    it('has correct runtime configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'sensor_processor.handler',
        Runtime: 'python3.9',
        Environment: {
          Variables: Match.objectLike({
            ENVIRONMENT: 'dev'
          })
        }
      });
    });

    it('has correct IAM role and policies', () => {
      // Check Lambda execution role
      const roleProperties = template.findResources('AWS::IAM::Role');
      const roleLogicalIds = Object.keys(roleProperties);
      const lambdaRole = roleProperties[roleLogicalIds[0]];

      expect(lambdaRole.Properties.AssumeRolePolicyDocument).toEqual({
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com'
          }
        }],
        Version: '2012-10-17'
      });

      expect(lambdaRole.Properties.ManagedPolicyArns).toEqual(
        expect.arrayContaining([
          {
            'Fn::Join': ['', [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ]]
          }
        ])
      );

      // Find and check IAM policies
      const policyProperties = template.findResources('AWS::IAM::Policy');
      const policyLogicalIds = Object.keys(policyProperties);

      // Check that we have at least one policy with DynamoDB permissions
      const hasDynamoDBPolicy = policyLogicalIds.some(id => {
        const policy = policyProperties[id];
        const statements = policy.Properties.PolicyDocument.Statement;
        return statements.some((statement: any) =>
          statement.Action.some((action: string) => action.startsWith('dynamodb:'))
        );
      });

      expect(hasDynamoDBPolicy).toBe(true);

      // Check that we have at least one policy with S3 permissions
      const hasS3Policy = policyLogicalIds.some(id => {
        const policy = policyProperties[id];
        const statements = policy.Properties.PolicyDocument.Statement;
        return statements.some((statement: any) =>
          statement.Action.some((action: string) => action.startsWith('s3:'))
        );
      });

      expect(hasS3Policy).toBe(true);
    });
  });
});
