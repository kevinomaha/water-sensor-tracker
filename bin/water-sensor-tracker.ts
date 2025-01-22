#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WaterSensorTrackerStack } from '../lib/water-sensor-tracker-stack';

const app = new cdk.App();
new WaterSensorTrackerStack(app, 'WaterSensorTrackerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  tags: {
    environment: 'dev',
    project: 'water-sensor-tracker'
  }
});
