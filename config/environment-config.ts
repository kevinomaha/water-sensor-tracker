export interface EnvironmentConfig {
  environment: string;
  envName: string;
  apiDescription: string;
  retentionDays: number;
  isProd: boolean;
  stackName: string;
}

export const environments: { [key: string]: EnvironmentConfig } = {
  dev: {
    environment: 'dev',
    envName: 'dev',
    apiDescription: 'Development API for Water Sensor Tracker',
    retentionDays: 30,
    isProd: false,
    stackName: 'WaterSensorTracker-Dev'
  },
  prod: {
    environment: 'prod',
    envName: 'prod',
    apiDescription: 'Production API for Water Sensor Tracker',
    retentionDays: 90,
    isProd: true,
    stackName: 'WaterSensorTracker-Prod'
  }
};
