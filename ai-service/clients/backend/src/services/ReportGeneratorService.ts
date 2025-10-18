import puppeteer from 'puppeteer';
import { logger } from '../utils/logger';
import { DateRange } from '../types';

/**
 * Report generator service for creating PDF reports
 * Uses Puppeteer to generate PDF reports from HTML templates
 */
export class ReportGeneratorService {
  private browser: any = null;

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Generate PDF report from data
   */
  async generatePDFReport(
    reportType: string,
    data: any,
    options: {
      period: DateRange;
      filters: any;
      includeCharts: boolean;
      template: string;
    }
  ): Promise<Buffer> {
    try {
      await this.initBrowser();
      const page = await this.browser.newPage();

      // Generate HTML content based on report type
      const htmlContent = this.generateHTMLContent(reportType, data, options);

      // Set page content
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(reportType, options),
        footerTemplate: this.getFooterTemplate()
      });

      await page.close();

      logger.info('PDF report generated successfully', {
        reportType,
        sizeBytes: pdfBuffer.length,
        includeCharts: options.includeCharts
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate PDF report', { error: error.message, reportType });
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for the report
   */
  private generateHTMLContent(
    reportType: string,
    data: any,
    options: {
      period: DateRange;
      filters: any;
      includeCharts: boolean;
      template: string;
    }
  ): string {
    const { period, filters, includeCharts, template } = options;

    const baseStyles = `
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #007acc;
          padding-bottom: 20px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #007acc;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 16px;
          color: #666;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #007acc;
          margin-bottom: 15px;
          border-left: 4px solid #007acc;
          padding-left: 10px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        .kpi-card {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }
        .kpi-value {
          font-size: 32px;
          font-weight: bold;
          color: #007acc;
          margin-bottom: 5px;
        }
        .kpi-label {
          font-size: 14px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .kpi-trend {
          font-size: 12px;
          margin-top: 5px;
        }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .table th,
        .table td {
          border: 1px solid #dee2e6;
          padding: 12px;
          text-align: left;
        }
        .table th {
          background-color: #007acc;
          color: white;
          font-weight: bold;
        }
        .table tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        .chart-placeholder {
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          color: #6c757d;
          margin: 20px 0;
        }
        .filters-info {
          background: #e7f3ff;
          border: 1px solid #b3d9ff;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        .filters-title {
          font-weight: bold;
          margin-bottom: 10px;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    `;

    let content = '';

    switch (reportType) {
      case 'dashboard':
        content = this.generateDashboardReport(data, options);
        break;
      case 'performance':
        content = this.generatePerformanceReport(data, options);
        break;
      case 'sla':
        content = this.generateSLAReport(data, options);
        break;
      case 'customer':
        content = this.generateCustomerReport(data, options);
        break;
      default:
        content = this.generateGenericReport(data, options);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${this.getReportTitle(reportType)} Report</title>
        ${baseStyles}
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }

  /**
   * Generate dashboard report content
   */
  private generateDashboardReport(data: any, options: any): string {
    const { period, filters } = options;
    
    return `
      <div class="header">
        <div class="title">Dashboard Analytics Report</div>
        <div class="subtitle">
          Period: ${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}
        </div>
      </div>

      ${this.generateFiltersSection(filters)}

      <div class="section">
        <div class="section-title">Key Performance Indicators</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">${data.totalTickets || 0}</div>
            <div class="kpi-label">Total Tickets</div>
            <div class="kpi-trend trend-up">↗ +5.2%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${data.avgResponseTime || 0}m</div>
            <div class="kpi-label">Avg Response Time</div>
            <div class="kpi-trend trend-down">↘ -2.1%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${data.slaCompliance || 0}%</div>
            <div class="kpi-label">SLA Compliance</div>
            <div class="kpi-trend trend-up">↗ +1.8%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${data.satisfaction || 0}</div>
            <div class="kpi-label">Customer Satisfaction</div>
            <div class="kpi-trend trend-stable">→ 0.0%</div>
          </div>
        </div>
      </div>

      ${options.includeCharts ? this.generateChartsSection() : ''}

      <div class="section">
        <div class="section-title">Summary</div>
        <p>This report provides an overview of key metrics for the selected period. The data shows overall performance trends and highlights areas for improvement.</p>
      </div>
    `;
  }

  /**
   * Generate performance report content
   */
  private generatePerformanceReport(data: any, options: any): string {
    return `
      <div class="header">
        <div class="title">Performance Analytics Report</div>
        <div class="subtitle">
          Period: ${options.period.startDate.toLocaleDateString()} - ${options.period.endDate.toLocaleDateString()}
        </div>
      </div>

      ${this.generateFiltersSection(options.filters)}

      <div class="section">
        <div class="section-title">Team Performance Metrics</div>
        <table class="table">
          <thead>
            <tr>
              <th>Technician</th>
              <th>Tickets Resolved</th>
              <th>Avg Resolution Time</th>
              <th>SLA Compliance</th>
              <th>Customer Satisfaction</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sample Technician</td>
              <td>25</td>
              <td>120 min</td>
              <td>95%</td>
              <td>4.2</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate SLA report content
   */
  private generateSLAReport(data: any, options: any): string {
    return `
      <div class="header">
        <div class="title">SLA Compliance Report</div>
        <div class="subtitle">
          Period: ${options.period.startDate.toLocaleDateString()} - ${options.period.endDate.toLocaleDateString()}
        </div>
      </div>

      ${this.generateFiltersSection(options.filters)}

      <div class="section">
        <div class="section-title">SLA Performance Overview</div>
        <p>Detailed analysis of SLA compliance metrics and breach incidents.</p>
      </div>
    `;
  }

  /**
   * Generate customer report content
   */
  private generateCustomerReport(data: any, options: any): string {
    return `
      <div class="header">
        <div class="title">Customer Analytics Report</div>
        <div class="subtitle">
          Period: ${options.period.startDate.toLocaleDateString()} - ${options.period.endDate.toLocaleDateString()}
        </div>
      </div>

      ${this.generateFiltersSection(options.filters)}

      <div class="section">
        <div class="section-title">Customer Satisfaction Metrics</div>
        <p>Analysis of customer satisfaction scores and feedback trends.</p>
      </div>
    `;
  }

  /**
   * Generate generic report content
   */
  private generateGenericReport(data: any, options: any): string {
    return `
      <div class="header">
        <div class="title">Analytics Report</div>
        <div class="subtitle">
          Period: ${options.period.startDate.toLocaleDateString()} - ${options.period.endDate.toLocaleDateString()}
        </div>
      </div>

      ${this.generateFiltersSection(options.filters)}

      <div class="section">
        <div class="section-title">Report Data</div>
        <p>Custom analytics report with filtered data.</p>
      </div>
    `;
  }

  /**
   * Generate filters section
   */
  private generateFiltersSection(filters: any): string {
    if (!filters || Object.keys(filters).length === 0) {
      return '';
    }

    const filterItems = Object.entries(filters)
      .filter(([key, value]) => value && Array.isArray(value) && value.length > 0)
      .map(([key, value]) => `<strong>${key}:</strong> ${(value as string[]).join(', ')}`)
      .join('<br>');

    if (!filterItems) {
      return '';
    }

    return `
      <div class="filters-info">
        <div class="filters-title">Applied Filters:</div>
        ${filterItems}
      </div>
    `;
  }

  /**
   * Generate charts section placeholder
   */
  private generateChartsSection(): string {
    return `
      <div class="section page-break">
        <div class="section-title">Charts and Visualizations</div>
        <div class="chart-placeholder">
          <h3>Ticket Volume Trend</h3>
          <p>Chart visualization would appear here</p>
        </div>
        <div class="chart-placeholder">
          <h3>Response Time Analysis</h3>
          <p>Chart visualization would appear here</p>
        </div>
      </div>
    `;
  }

  /**
   * Get header template for PDF
   */
  private getHeaderTemplate(reportType: string, options: any): string {
    return `
      <div style="font-size: 10px; padding: 5px 15px; width: 100%; text-align: center; color: #666;">
        <span>${this.getReportTitle(reportType)} Report - Generated on ${new Date().toLocaleDateString()}</span>
      </div>
    `;
  }

  /**
   * Get footer template for PDF
   */
  private getFooterTemplate(): string {
    return `
      <div style="font-size: 10px; padding: 5px 15px; width: 100%; text-align: center; color: #666;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;
  }

  /**
   * Get report title based on type
   */
  private getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard Analytics',
      performance: 'Performance Analytics',
      sla: 'SLA Compliance',
      customer: 'Customer Analytics'
    };
    return titles[reportType] || 'Analytics';
  }

  /**
   * Close browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton instance
export const reportGeneratorService = new ReportGeneratorService();