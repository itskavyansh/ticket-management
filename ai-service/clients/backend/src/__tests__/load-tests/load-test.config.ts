/**
 * Load Testing Configuration
 * Defines test scenarios, user patterns, and performance thresholds
 */

export interface LoadTestConfig {
  baseUrl: string;
  scenarios: LoadTestScenario[];
  thresholds: PerformanceThresholds;
  testData: TestDataConfig;
}

export interface LoadTestScenario {
  name: string;
  description: string;
  phases: LoadPhase[];
  weight: number; // Percentage of total traffic
}

export interface LoadPhase {
  duration: string;
  arrivalRate?: number; // requests per second
  arrivalCount?: number; // total requests
  rampTo?: number; // ramp up to this rate
}

export interface PerformanceThresholds {
  responseTime: {
    p50: number; // 50th percentile in ms
    p95: number; // 95th percentile in ms
    p99: number; // 99th percentile in ms
  };
  errorRate: number; // Maximum acceptable error rate (%)
  throughput: number; // Minimum requests per second
}

export interface TestDataConfig {
  users: number;
  tickets: number;
  technicians: number;
  customers: number;
}

export const defaultLoadTestConfig: LoadTestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  scenarios: [
    {
      name: 'ticket_management_flow',
      description: 'Standard ticket CRUD operations',
      phases: [
        { duration: '2m', arrivalRate: 5 }, // Warm up
        { duration: '5m', arrivalRate: 10, rampTo: 50 }, // Ramp up
        { duration: '10m', arrivalRate: 50 }, // Sustained load
        { duration: '3m', arrivalRate: 50, rampTo: 5 }, // Ramp down
      ],
      weight: 60,
    },
    {
      name: 'ai_processing_flow',
      description: 'AI triage and resolution suggestions',
      phases: [
        { duration: '2m', arrivalRate: 2 },
        { duration: '5m', arrivalRate: 5, rampTo: 20 },
        { duration: '10m', arrivalRate: 20 },
        { duration: '3m', arrivalRate: 20, rampTo: 2 },
      ],
      weight: 25,
    },
    {
      name: 'analytics_dashboard_flow',
      description: 'Dashboard and reporting queries',
      phases: [
        { duration: '2m', arrivalRate: 3 },
        { duration: '5m', arrivalRate: 8, rampTo: 30 },
        { duration: '10m', arrivalRate: 30 },
        { duration: '3m', arrivalRate: 30, rampTo: 3 },
      ],
      weight: 15,
    },
  ],
  thresholds: {
    responseTime: {
      p50: 500, // 500ms for 50th percentile
      p95: 2000, // 2s for 95th percentile
      p99: 5000, // 5s for 99th percentile
    },
    errorRate: 1, // 1% maximum error rate
    throughput: 100, // Minimum 100 requests per second
  },
  testData: {
    users: 1000,
    tickets: 10000,
    technicians: 50,
    customers: 200,
  },
};

export const stressTestConfig: LoadTestConfig = {
  ...defaultLoadTestConfig,
  scenarios: [
    {
      name: 'stress_test_scenario',
      description: 'High load stress testing',
      phases: [
        { duration: '1m', arrivalRate: 10 },
        { duration: '3m', arrivalRate: 10, rampTo: 100 },
        { duration: '5m', arrivalRate: 100, rampTo: 200 },
        { duration: '10m', arrivalRate: 200 },
        { duration: '5m', arrivalRate: 200, rampTo: 10 },
      ],
      weight: 100,
    },
  ],
  thresholds: {
    responseTime: {
      p50: 1000,
      p95: 5000,
      p99: 10000,
    },
    errorRate: 5, // Allow higher error rate during stress test
    throughput: 150,
  },
};

export const spikeTestConfig: LoadTestConfig = {
  ...defaultLoadTestConfig,
  scenarios: [
    {
      name: 'spike_test_scenario',
      description: 'Sudden traffic spikes',
      phases: [
        { duration: '2m', arrivalRate: 10 }, // Normal load
        { duration: '30s', arrivalRate: 500 }, // Sudden spike
        { duration: '2m', arrivalRate: 10 }, // Back to normal
        { duration: '30s', arrivalRate: 300 }, // Another spike
        { duration: '2m', arrivalRate: 10 }, // Recovery
      ],
      weight: 100,
    },
  ],
  thresholds: {
    responseTime: {
      p50: 2000,
      p95: 8000,
      p99: 15000,
    },
    errorRate: 10, // Higher tolerance during spikes
    throughput: 50,
  },
};