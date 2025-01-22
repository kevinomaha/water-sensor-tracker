# Water Sensor Tracker

A cloud-based water sensor tracking system built with AWS CDK.

## Architecture

This project uses various AWS services to create a scalable and reliable water sensor tracking system:

- **API Gateway**: REST API endpoints for sensor data ingestion and querying
- **Lambda Functions**: Serverless compute for processing sensor data
- **DynamoDB**: NoSQL database for storing sensor readings
- **S3**: Object storage for sensor data archives
- **CloudWatch**: Monitoring and alerting

## Project Structure

- `/lib`: CDK infrastructure code
- `/lambda`: Lambda function code
- `/test`: Unit tests
- `/bin`: CDK app entry point

## Prerequisites

- Node.js and npm
- AWS CDK CLI
- AWS CLI configured with appropriate credentials
- TypeScript

## Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Bootstrap CDK (if not already done):
   ```bash
   npx cdk bootstrap
   ```

3. Deploy the stack:
   ```bash
   npx cdk deploy
   ```

## Development

- `npm run build`: Compile TypeScript to JS
- `npm run watch`: Watch for changes and compile
- `npm run test`: Run tests
- `npx cdk diff`: Compare deployed stack with current state
- `npx cdk synth`: Emits the synthesized CloudFormation template
