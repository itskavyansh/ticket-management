/**
 * Utility functions for safe data formatting
 */

/**
 * Safely format a number as a percentage
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Safely format a number with specified decimal places
 */
export function formatNumber(value: number | undefined | null, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return value.toFixed(decimals);
}

/**
 * Safely format a duration in hours
 */
export function formatDuration(hours: number | undefined | null): string {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '0h';
  }
  return `${hours.toFixed(1)}h`;
}

/**
 * Safely format a large number with commas (Indian format)
 */
export function formatLargeNumber(value: number | undefined | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return value.toLocaleString('en-IN');
}

/**
 * Format currency in Indian Rupees
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Safely get a color based on a threshold
 */
export function getThresholdColor(
  value: number | undefined | null,
  thresholds: { low: number; medium: number; high: number },
  colors: { low: string; medium: string; high: string; critical: string }
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return colors.low;
  }
  
  if (value >= thresholds.high) return colors.critical;
  if (value >= thresholds.medium) return colors.high;
  if (value >= thresholds.low) return colors.medium;
  return colors.low;
}

/**
 * Safely calculate percentage
 */
export function calculatePercentage(value: number | undefined | null, total: number | undefined | null): number {
  if (!value || !total || total === 0) {
    return 0;
  }
  return (value / total) * 100;
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Safe chart label formatter for Recharts
 */
export function safeChartLabel(data: any): string {
  if (!data || typeof data.percentage !== 'number') {
    return '';
  }
  return data.percentage < 5 ? '' : `${data.percentage.toFixed(0)}%`;
}