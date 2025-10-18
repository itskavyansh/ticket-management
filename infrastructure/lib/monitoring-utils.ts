import { CloudWatch } from 'aws-sdk';

/**
 * Utility class for publishing custom CloudWatch metrics
 * Used by application services to send business metrics
 */
export class MonitoringUtils {
  private cloudWatch: CloudWatch;
  private namespace: string;

  constructor(region: string = 'us-east-1') {
    this.cloudWatch = new CloudWatch({ region });
    this.namespace = 'AiTicketManagement/Business';
  }

  /**
   * Publish a custom metric to CloudWatch
   */
  async publishMetric(
    metricName: string,
    value: number,
    unit: string = 'Count',
    dimensions: { [key: string]: string } = {}
  ): Promise<void> {
    const params: CloudWatch.PutMetricDataRequest = {
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: Object.entries(dimensions).map(([name, value]) => ({
            Name: name,
            Value: value,
          })),
        },
      ],
    };

    try {
      await this.cloudWatch.putMetricData(params).promise();
    } catch (error) {
      console.error('Failed to publish metric:', error);
      // Don't throw error to avoid breaking application flow
    }
  }

  /**
   * Publish ticket processing time metric
   */
  async publishTicketProcessingTime(
    processingTimeMs: number,
    ticketCategory: string,
    technicianId: string
  ): Promise<void> {
    await this.publishMetric(
      'TicketProcessingTime',
      processingTimeMs,
      'Milliseconds',
      {
        Category: ticketCategory,
        TechnicianId: technicianId,
      }
    );
  }

  /**
   * Publish SLA compliance metric
   */
  async publishSLACompliance(
    complianceRate: number,
    customerId: string
  ): Promise<void> {
    await this.publishMetric(
      'SLAComplianceRate',
      complianceRate,
      'Percent',
      {
        CustomerId: customerId,
      }
    );
  }

  /**
   * Publish ticket creation metric
   */
  async publishTicketCreated(
    priority: string,
    category: string,
    customerId: string
  ): Promise<void> {
    await this.publishMetric(
      'TicketsCreated',
      1,
      'Count',
      {
        Priority: priority,
        Category: category,
        CustomerId: customerId,
      }
    );
  }

  /**
   * Publish ticket resolution metric
   */
  async publishTicketResolved(
    resolutionTimeMs: number,
    priority: string,
    category: string,
    technicianId: string
  ): Promise<void> {
    await this.publishMetric(
      'TicketsResolved',
      1,
      'Count',
      {
        Priority: priority,
        Category: category,
        TechnicianId: technicianId,
      }
    );

    // Also publish resolution time
    await this.publishMetric(
      'TicketResolutionTime',
      resolutionTimeMs,
      'Milliseconds',
      {
        Priority: priority,
        Category: category,
        TechnicianId: technicianId,
      }
    );
  }

  /**
   * Publish SLA breach risk metric
   */
  async publishSLABreachRisk(
    ticketsAtRisk: number,
    customerId?: string
  ): Promise<void> {
    const dimensions: { [key: string]: string } = {};
    if (customerId) {
      dimensions.CustomerId = customerId;
    }

    await this.publishMetric(
      'TicketsAtRiskOfSLABreach',
      ticketsAtRisk,
      'Count',
      dimensions
    );
  }

  /**
   * Publish AI model performance metrics
   */
  async publishAIModelMetrics(
    modelName: string,
    accuracy: number,
    inferenceTimeMs: number,
    confidence: number
  ): Promise<void> {
    const dimensions = { ModelName: modelName };

    await Promise.all([
      this.publishMetric('AIModelAccuracy', accuracy, 'Percent', dimensions),
      this.publishMetric('AIModelInferenceTime', inferenceTimeMs, 'Milliseconds', dimensions),
      this.publishMetric('AIModelConfidence', confidence, 'Percent', dimensions),
    ]);
  }

  /**
   * Publish technician workload metrics
   */
  async publishTechnicianWorkload(
    technicianId: string,
    activeTickets: number,
    utilizationRate: number,
    avgResolutionTimeMs: number
  ): Promise<void> {
    const dimensions = { TechnicianId: technicianId };

    await Promise.all([
      this.publishMetric('TechnicianActiveTickets', activeTickets, 'Count', dimensions),
      this.publishMetric('TechnicianUtilization', utilizationRate, 'Percent', dimensions),
      this.publishMetric('TechnicianAvgResolutionTime', avgResolutionTimeMs, 'Milliseconds', dimensions),
    ]);
  }

  /**
   * Publish integration health metrics
   */
  async publishIntegrationHealth(
    integrationName: string,
    isHealthy: boolean,
    responseTimeMs: number,
    errorCount: number = 0
  ): Promise<void> {
    const dimensions = { Integration: integrationName };

    await Promise.all([
      this.publishMetric('IntegrationHealth', isHealthy ? 1 : 0, 'Count', dimensions),
      this.publishMetric('IntegrationResponseTime', responseTimeMs, 'Milliseconds', dimensions),
      this.publishMetric('IntegrationErrors', errorCount, 'Count', dimensions),
    ]);
  }
}

/**
 * Singleton instance for easy access across the application
 */
export const monitoring = new MonitoringUtils();

/**
 * Decorator for automatic performance monitoring of functions
 */
export function MonitorPerformance(metricName: string, dimensions: { [key: string]: string } = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        await monitoring.publishMetric(
          metricName,
          duration,
          'Milliseconds',
          dimensions
        );
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        await monitoring.publishMetric(
          `${metricName}Error`,
          duration,
          'Milliseconds',
          dimensions
        );
        
        throw error;
      }
    };
  };
}