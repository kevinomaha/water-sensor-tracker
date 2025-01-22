#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WaterSensorTrackerStack } from '../lib/water-sensor-tracker-stack';
import { environments } from '../config/environment-config';

const app = new cdk.App();

// Deploy stacks for each environment
Object.values(environments).forEach(envConfig => {
  new WaterSensorTrackerStack(app, envConfig.stackName, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
    },
    tags: {
      environment: envConfig.environment,
      project: 'water-sensor-tracker'
    },
    environmentConfig: envConfig
  });
});
