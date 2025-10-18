/**
 * Performance Test Runner and Reporting System
 * Orchestrates all performance tests and generates comprehensive reports
 */

import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TestResult {
  testName: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  metrics: {
    responseTime?: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
      max: number;
    };
    throughput?: number;
    errorRate?: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      connections: number;
    };
  };
  thresholds: {
    [key: string]: {
      value: number;
      threshold: number;
      passed: boolean;
    };
  };
  recommendations: string[];
  errors?: string[];
}

export interface PerformanceReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
    totalMemory: number;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    overallDuration: number;
  };
  categories: {
    [category: string]: {
      tests: TestResult[];
      summary: {
        passed: number;
        failed: number;
        avgDuration: number;
      };
    };
  };
  recommendations: string[];
  criticalIssues: string[];
}

export class PerformanceTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private outputDir: string = './performance-reports') {
    // Ensure output directory exists
    try {
      mkdirSync(this.outputDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create output directory:', error);
    }
  }

  async runAllTests(): Promise<PerformanceReport> {
    console.log('🚀 Starting comprehensive performance test suite...');
    this.startTime = performance.now();

    // Run test categories in sequence
    await this.runLoadTests();
    await this.runDatabaseTests();
    await this.runCacheTests();
    await this.runAIServiceTests();
    await this.runSystemIntegrationTests();
    await this.runAutoScalingTests();

    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);

    return report;
  }

  private async runLoadTests(): Promise<void> {
    console.log('📊 Running load tests...');
    
    const loadTestCases = [
      {
        name: 'Standard Load Test',
        test: () => this.simulateLoadTest('standard', 100, 60),
        thresholds: {
          avgResponseTime: 1000,
          p95ResponseTime: 2000,
          errorRate: 1,
          throughput: 80
        }
      },
      {
        name: 'Stress Load Test',
        test: () => this.simulateLoadTest('stress', 500, 120),
        thresholds: {
          avgResponseTime: 3000,
          p95ResponseTime: 8000,
          errorRate: 5,
          throughput: 200
        }
      },
      {
        name: 'Spike Load Test',
        test: () => this.simulateLoadTest('spike', 1000, 30),
        thresholds: {
          avgResponseTime: 5000,
          p95ResponseTime: 15000,
          errorRate: 10,
          throughput: 100
        }
      }
    ];

    for (const testCase of loadTestCases) {
      await this.runTest('Load Testing', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runDatabaseTests(): Promise<void> {
    console.log('🗄️ Running database performance tests...');
    
    const dbTestCases = [
      {
        name: 'Query Performance',
        test: () => this.simulateDatabaseTest('queries'),
        thresholds: {
          avgQueryTime: 100,
          maxQueryTime: 500,
          connectionPoolUtilization: 80
        }
      },
      {
        name: 'Connection Pool Performance',
        test: () => this.simulateDatabaseTest('connections'),
        thresholds: {
          avgConnectionTime: 50,
          maxConnections: 25,
          connectionLeaks: 0
        }
      },
      {
        name: 'Index Effectiveness',
        test: () => this.simulateDatabaseTest('indexes'),
        thresholds: {
          indexUsageRate: 90,
          sequentialScanRate: 10
        }
      }
    ];

    for (const testCase of dbTestCases) {
      await this.runTest('Database Performance', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runCacheTests(): Promise<void> {
    console.log('⚡ Running cache performance tests...');
    
    const cacheTestCases = [
      {
        name: 'Redis Performance',
        test: () => this.simulateCacheTest('redis'),
        thresholds: {
          avgResponseTime: 10,
          hitRate: 80,
          memoryUsage: 70
        }
      },
      {
        name: 'API Cache Effectiveness',
        test: () => this.simulateCacheTest('api'),
        thresholds: {
          hitRate: 60,
          cacheSpeedup: 3
        }
      }
    ];

    for (const testCase of cacheTestCases) {
      await this.runTest('Cache Performance', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runAIServiceTests(): Promise<void> {
    console.log('🤖 Running AI service performance tests...');
    
    const aiTestCases = [
      {
        name: 'Ticket Triage Performance',
        test: () => this.simulateAITest('triage'),
        thresholds: {
          avgInferenceTime: 3000,
          maxInferenceTime: 8000,
          accuracy: 85
        }
      },
      {
        name: 'Resolution Suggestion Performance',
        test: () => this.simulateAITest('resolution'),
        thresholds: {
          avgInferenceTime: 5000,
          maxInferenceTime: 15000,
          relevanceScore: 70
        }
      },
      {
        name: 'SLA Prediction Performance',
        test: () => this.simulateAITest('sla'),
        thresholds: {
          avgInferenceTime: 1000,
          maxInferenceTime: 3000,
          accuracy: 80
        }
      }
    ];

    for (const testCase of aiTestCases) {
      await this.runTest('AI Service Performance', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runSystemIntegrationTests(): Promise<void> {
    console.log('🔗 Running system integration tests...');
    
    const integrationTestCases = [
      {
        name: 'Database Failure Recovery',
        test: () => this.simulateFailureTest('database'),
        thresholds: {
          recoveryTime: 30000,
          dataConsistency: 100,
          errorRate: 5
        }
      },
      {
        name: 'Cache Failure Handling',
        test: () => this.simulateFailureTest('cache'),
        thresholds: {
          degradationFactor: 3,
          errorRate: 2
        }
      },
      {
        name: 'AI Service Fallback',
        test: () => this.simulateFailureTest('ai'),
        thresholds: {
          fallbackActivation: 5000,
          serviceAvailability: 95
        }
      }
    ];

    for (const testCase of integrationTestCases) {
      await this.runTest('System Integration', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runAutoScalingTests(): Promise<void> {
    console.log('📈 Running auto-scaling tests...');
    
    const scalingTestCases = [
      {
        name: 'Horizontal Scaling',
        test: () => this.simulateScalingTest('horizontal'),
        thresholds: {
          scaleUpTime: 60000,
          scaleDownTime: 120000,
          resourceEfficiency: 80
        }
      },
      {
        name: 'Load Balancing',
        test: () => this.simulateScalingTest('loadbalancing'),
        thresholds: {
          distributionFairness: 80,
          failoverTime: 10000
        }
      }
    ];

    for (const testCase of scalingTestCases) {
      await this.runTest('Auto-scaling', testCase.name, testCase.test, testCase.thresholds);
    }
  }

  private async runTest(
    category: string,
    testName: string,
    testFunction: () => Promise<any>,
    thresholds: { [key: string]: number }
  ): Promise<void> {
    const startTime = performance.now();
    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    let metrics: any = {};
    let errors: string[] = [];
    let recommendations: string[] = [];

    try {
      console.log(`  Running: ${testName}...`);
      metrics = await testFunction();
      
      // Check thresholds
      const thresholdResults: any = {};
      for (const [key, threshold] of Object.entries(thresholds)) {
        const value = metrics[key];
        const passed = this.checkThreshold(key, value, threshold);
        thresholdResults[key] = { value, threshold, passed };
        
        if (!passed) {
          status = 'failed';
          errors.push(`${key} threshold exceeded: ${value} > ${threshold}`);
        }
      }

      // Generate recommendations
      recommendations = this.generateRecommendations(testName, metrics, thresholdResults);

    } catch (error) {
      status = 'failed';
      errors.push(`Test execution failed: ${error}`);
      console.error(`  ❌ ${testName} failed:`, error);
    }

    const duration = performance.now() - startTime;

    const result: TestResult = {
      testName,
      category,
      status,
      duration,
      metrics,
      thresholds: {},
      recommendations,
      errors: errors.length > 0 ? errors : undefined
    };

    this.results.push(result);

    const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
    console.log(`  ${statusIcon} ${testName} (${duration.toFixed(2)}ms)`);
  }

  private checkThreshold(metric: string, value: number, threshold: number): boolean {
    // Different metrics have different comparison logic
    const reverseMetrics = ['errorRate', 'avgResponseTime', 'p95ResponseTime', 'p99ResponseTime', 'maxResponseTime'];
    
    if (reverseMetrics.includes(metric)) {
      return value <= threshold;
    } else {
      return value >= threshold;
    }
  }

  private generateRecommendations(testName: string, metrics: any, thresholds: any): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (thresholds.avgResponseTime && !thresholds.avgResponseTime.passed) {
      recommendations.push('Consider implementing response caching or optimizing database queries');
    }

    // Error rate recommendations
    if (thresholds.errorRate && !thresholds.errorRate.passed) {
      recommendations.push('Investigate error logs and implement better error handling');
    }

    // Throughput recommendations
    if (thresholds.throughput && !thresholds.throughput.passed) {
      recommendations.push('Consider horizontal scaling or performance optimization');
    }

    // Cache recommendations
    if (thresholds.hitRate && !thresholds.hitRate.passed) {
      recommendations.push('Review cache strategy and TTL settings');
    }

    return recommendations;
  }

  // Simulation methods (in real implementation, these would call actual test functions)
  private async simulateLoadTest(type: string, rps: number, duration: number): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    return {
      avgResponseTime: Math.random() * 2000 + 200,
      p95ResponseTime: Math.random() * 4000 + 1000,
      p99ResponseTime: Math.random() * 8000 + 2000,
      errorRate: Math.random() * 3,
      throughput: rps * (0.8 + Math.random() * 0.4)
    };
  }

  private async simulateDatabaseTest(type: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 200));
    
    const baseMetrics = {
      avgQueryTime: Math.random() * 150 + 50,
      maxQueryTime: Math.random() * 800 + 200,
      connectionPoolUtilization: Math.random() * 40 + 40,
      indexUsageRate: Math.random() * 20 + 80,
      avgConnectionTime: Math.random() * 100 + 25,
      maxConnections: Math.floor(Math.random() * 10) + 20,
      connectionLeaks: Math.floor(Math.random() * 2),
      sequentialScanRate: Math.random() * 15 + 5
    };

    return baseMetrics;
  }

  private async simulateCacheTest(type: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
    
    return {
      avgResponseTime: Math.random() * 20 + 5,
      hitRate: Math.random() * 30 + 60,
      memoryUsage: Math.random() * 40 + 30,
      cacheSpeedup: Math.random() * 5 + 2
    };
  }

  private async simulateAITest(type: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    return {
      avgInferenceTime: Math.random() * 4000 + 1000,
      maxInferenceTime: Math.random() * 10000 + 3000,
      accuracy: Math.random() * 20 + 75,
      relevanceScore: Math.random() * 30 + 60
    };
  }

  private async simulateFailureTest(type: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
    
    return {
      recoveryTime: Math.random() * 40000 + 10000,
      dataConsistency: Math.random() * 10 + 90,
      errorRate: Math.random() * 8 + 2,
      degradationFactor: Math.random() * 3 + 1,
      fallbackActivation: Math.random() * 8000 + 2000,
      serviceAvailability: Math.random() * 10 + 90
    };
  }

  private async simulateScalingTest(type: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    return {
      scaleUpTime: Math.random() * 80000 + 20000,
      scaleDownTime: Math.random() * 160000 + 40000,
      resourceEfficiency: Math.random() * 30 + 60,
      distributionFairness: Math.random() * 30 + 70,
      failoverTime: Math.random() * 15000 + 5000
    };
  }

  private generateReport(): PerformanceReport {
    const totalDuration = performance.now() - this.startTime;
    
    // Group results by category
    const categories: { [key: string]: any } = {};
    
    for (const result of this.results) {
      if (!categories[result.category]) {
        categories[result.category] = {
          tests: [],
          summary: { passed: 0, failed: 0, avgDuration: 0 }
        };
      }
      
      categories[result.category].tests.push(result);
      
      if (result.status === 'passed') {
        categories[result.category].summary.passed++;
      } else if (result.status === 'failed') {
        categories[result.category].summary.failed++;
      }
    }

    // Calculate averages
    for (const category of Object.values(categories)) {
      const tests = (category as any).tests;
      (category as any).summary.avgDuration = tests.reduce((sum: number, test: TestResult) => sum + test.duration, 0) / tests.length;
    }

    // Generate overall recommendations
    const recommendations = this.generateOverallRecommendations();
    const criticalIssues = this.identifyCriticalIssues();

    return {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) // GB
      },
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        skipped: this.results.filter(r => r.status === 'skipped').length,
        overallDuration: totalDuration
      },
      categories,
      recommendations,
      criticalIssues
    };
  }

  private generateOverallRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => r.status === 'failed');
    
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed - review individual test recommendations`);
    }

    // Add specific recommendations based on patterns
    const loadTestFailures = failedTests.filter(r => r.category === 'Load Testing');
    if (loadTestFailures.length > 0) {
      recommendations.push('Consider implementing horizontal scaling or performance optimization');
    }

    const dbTestFailures = failedTests.filter(r => r.category === 'Database Performance');
    if (dbTestFailures.length > 0) {
      recommendations.push('Database optimization needed - review queries and indexing strategy');
    }

    return recommendations;
  }

  private identifyCriticalIssues(): string[] {
    const criticalIssues: string[] = [];
    
    // Identify critical performance issues
    for (const result of this.results) {
      if (result.status === 'failed' && result.errors) {
        for (const error of result.errors) {
          if (error.includes('avgResponseTime') && error.includes('> 5000')) {
            criticalIssues.push(`Critical response time issue in ${result.testName}`);
          }
          if (error.includes('errorRate') && error.includes('> 10')) {
            criticalIssues.push(`High error rate detected in ${result.testName}`);
          }
        }
      }
    }

    return criticalIssues;
  }

  private saveReport(report: PerformanceReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-report-${timestamp}.json`;
    const filepath = join(this.outputDir, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`📄 Report saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }

    // Also save a summary HTML report
    this.saveHTMLReport(report, timestamp);
  }

  private saveHTMLReport(report: PerformanceReport, timestamp: string): void {
    const html = this.generateHTMLReport(report);
    const filename = `performance-report-${timestamp}.html`;
    const filepath = join(this.outputDir, filename);
    
    try {
      writeFileSync(filepath, html);
      console.log(`🌐 HTML report saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save HTML report:', error);
    }
  }

  private generateHTMLReport(report: PerformanceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - ${report.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4f8; padding: 15px; border-radius: 5px; flex: 1; }
        .category { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .category-header { background: #f0f0f0; padding: 10px; font-weight: bold; }
        .test { padding: 10px; border-bottom: 1px solid #eee; }
        .passed { color: green; }
        .failed { color: red; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .critical { background: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Environment:</strong> Node ${report.environment.nodeVersion} on ${report.environment.platform}</p>
        <p><strong>System:</strong> ${report.environment.cpuCount} CPUs, ${report.environment.totalMemory}GB RAM</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${report.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div style="font-size: 2em; color: green;">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div style="font-size: 2em; color: red;">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <div style="font-size: 2em;">${(report.summary.overallDuration / 1000).toFixed(1)}s</div>
        </div>
    </div>

    ${report.criticalIssues.length > 0 ? `
    <div class="critical">
        <h3>🚨 Critical Issues</h3>
        <ul>
            ${report.criticalIssues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${Object.entries(report.categories).map(([categoryName, category]) => `
    <div class="category">
        <div class="category-header">
            ${categoryName} (${(category as any).summary.passed}/${(category as any).tests.length} passed)
        </div>
        ${(category as any).tests.map((test: TestResult) => `
        <div class="test">
            <div class="${test.status}">
                <strong>${test.status === 'passed' ? '✅' : '❌'} ${test.testName}</strong>
                (${test.duration.toFixed(2)}ms)
            </div>
            ${test.recommendations.length > 0 ? `
            <div style="margin-top: 5px; font-size: 0.9em;">
                <strong>Recommendations:</strong>
                <ul style="margin: 5px 0;">
                    ${test.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>
    `).join('')}

</body>
</html>
    `;
  }

  private printSummary(report: PerformanceReport): void {
    console.log('\n📊 Performance Test Summary');
    console.log('═'.repeat(50));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⏭️ Skipped: ${report.summary.skipped}`);
    console.log(`⏱️ Duration: ${(report.summary.overallDuration / 1000).toFixed(2)}s`);

    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.criticalIssues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    console.log('\n' + '═'.repeat(50));
  }
}

// Export for use in test files
export default PerformanceTestRunner;