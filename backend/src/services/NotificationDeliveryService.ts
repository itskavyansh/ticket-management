import { v4 as uuidv4 } from 'uuid';
import {
  NotificationDelivery,
  NotificationRequest,
  DeliveryStatus,
  NotificationChannel
} from '../types/notification';
import { logger } from '../utils/logger';

export class NotificationDeliveryService {
  private deliveries: Map<string, NotificationDelivery> = new Map();
  private retryQueue: NotificationDelivery[] = [];
  private retryIntervals = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m
  private maxRetries = 5;
  private retryProcessor: NodeJS.Timeout | null = null;

  constructor() {
    this.startRetryProcessor();
  }

  /**
   * Create a new delivery record
   */
  createDelivery(
    notificationId: string,
    channelId: string,
    channelType: 'slack' | 'teams' | 'email',
    originalRequest: NotificationRequest
  ): NotificationDelivery {
    const delivery: NotificationDelivery = {
      id: uuidv4(),
      notificationId,
      channelId,
      channelType,
      status: DeliveryStatus.PENDING,
      attempts: 0,
      lastAttempt: new Date()
    };

    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  /**
   * Update delivery status
   */
  updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    error?: string
  ): void {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      logger.warn(`Delivery not found: ${deliveryId}`);
      return;
    }

    delivery.status = status;
    delivery.lastAttempt = new Date();
    
    if (status === DeliveryStatus.DELIVERED) {
      delivery.deliveredAt = new Date();
    }
    
    if (error) {
      delivery.error = error;
    }

    // Add to retry queue if failed and retryable
    if (status === DeliveryStatus.FAILED && this.isRetryable(delivery)) {
      delivery.status = DeliveryStatus.RETRYING;
      this.addToRetryQueue(delivery);
    }

    this.deliveries.set(deliveryId, delivery);
    
    logger.info(`Delivery ${deliveryId} status updated to ${status}`);
  }

  /**
   * Mark delivery as successful
   */
  markDeliverySuccess(deliveryId: string): void {
    this.updateDeliveryStatus(deliveryId, DeliveryStatus.DELIVERED);
    this.removeFromRetryQueue(deliveryId);
  }

  /**
   * Mark delivery as failed
   */
  markDeliveryFailed(deliveryId: string, error: string): void {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      return;
    }

    delivery.attempts++;
    this.updateDeliveryStatus(deliveryId, DeliveryStatus.FAILED, error);
  }

  /**
   * Get delivery by ID
   */
  getDelivery(deliveryId: string): NotificationDelivery | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Get all deliveries for a notification
   */
  getDeliveriesForNotification(notificationId: string): NotificationDelivery[] {
    return Array.from(this.deliveries.values()).filter(
      delivery => delivery.notificationId === notificationId
    );
  }

  /**
   * Get deliveries by status
   */
  getDeliveriesByStatus(status: DeliveryStatus): NotificationDelivery[] {
    return Array.from(this.deliveries.values()).filter(
      delivery => delivery.status === status
    );
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(): {
    total: number;
    byStatus: Record<DeliveryStatus, number>;
    byChannel: Record<string, number>;
    successRate: number;
    averageAttempts: number;
  } {
    const deliveries = Array.from(this.deliveries.values());
    const total = deliveries.length;
    
    const byStatus: Record<DeliveryStatus, number> = {
      [DeliveryStatus.PENDING]: 0,
      [DeliveryStatus.SENT]: 0,
      [DeliveryStatus.DELIVERED]: 0,
      [DeliveryStatus.FAILED]: 0,
      [DeliveryStatus.RETRYING]: 0
    };
    
    const byChannel: Record<string, number> = {};
    let totalAttempts = 0;
    
    deliveries.forEach(delivery => {
      byStatus[delivery.status]++;
      byChannel[delivery.channelType] = (byChannel[delivery.channelType] || 0) + 1;
      totalAttempts += delivery.attempts;
    });
    
    const successfulDeliveries = byStatus[DeliveryStatus.DELIVERED] + byStatus[DeliveryStatus.SENT];
    const successRate = total > 0 ? (successfulDeliveries / total) * 100 : 0;
    const averageAttempts = total > 0 ? totalAttempts / total : 0;
    
    return {
      total,
      byStatus,
      byChannel,
      successRate,
      averageAttempts
    };
  }

  /**
   * Clean up old deliveries
   */
  cleanupOldDeliveries(olderThanDays: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let cleaned = 0;
    for (const [deliveryId, delivery] of this.deliveries.entries()) {
      if (delivery.lastAttempt < cutoffDate) {
        this.deliveries.delete(deliveryId);
        this.removeFromRetryQueue(deliveryId);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned up ${cleaned} old delivery records`);
    return cleaned;
  }

  /**
   * Check if delivery is retryable
   */
  private isRetryable(delivery: NotificationDelivery): boolean {
    return delivery.attempts < this.maxRetries;
  }

  /**
   * Add delivery to retry queue
   */
  private addToRetryQueue(delivery: NotificationDelivery): void {
    // Remove existing entry if present
    this.removeFromRetryQueue(delivery.id);
    
    // Add to queue
    this.retryQueue.push(delivery);
    
    logger.info(`Added delivery ${delivery.id} to retry queue (attempt ${delivery.attempts})`);
  }

  /**
   * Remove delivery from retry queue
   */
  private removeFromRetryQueue(deliveryId: string): void {
    const index = this.retryQueue.findIndex(d => d.id === deliveryId);
    if (index !== -1) {
      this.retryQueue.splice(index, 1);
    }
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    if (this.retryProcessor) {
      return;
    }

    this.retryProcessor = setInterval(() => {
      this.processRetryQueue();
    }, 10000); // Check every 10 seconds

    logger.info('Notification delivery retry processor started');
  }

  /**
   * Stop retry processor
   */
  stopRetryProcessor(): void {
    if (this.retryProcessor) {
      clearInterval(this.retryProcessor);
      this.retryProcessor = null;
      logger.info('Notification delivery retry processor stopped');
    }
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) {
      return;
    }

    const now = new Date();
    const toRetry: NotificationDelivery[] = [];

    // Find deliveries ready for retry
    for (const delivery of this.retryQueue) {
      const timeSinceLastAttempt = now.getTime() - delivery.lastAttempt.getTime();
      const retryDelay = this.getRetryDelay(delivery.attempts);
      
      if (timeSinceLastAttempt >= retryDelay) {
        toRetry.push(delivery);
      }
    }

    // Process retries
    for (const delivery of toRetry) {
      try {
        await this.retryDelivery(delivery);
      } catch (error) {
        logger.error(`Error processing retry for delivery ${delivery.id}:`, error);
      }
    }
  }

  /**
   * Get retry delay based on attempt number
   */
  private getRetryDelay(attempts: number): number {
    const index = Math.min(attempts - 1, this.retryIntervals.length - 1);
    return this.retryIntervals[index];
  }

  /**
   * Retry a failed delivery
   */
  private async retryDelivery(delivery: NotificationDelivery): Promise<void> {
    delivery.attempts++;
    delivery.lastAttempt = new Date();

    // Check if we've exceeded max retries
    if (delivery.attempts >= this.maxRetries) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.error = `Max retries (${this.maxRetries}) exceeded`;
      this.removeFromRetryQueue(delivery.id);
      
      logger.warn(`Delivery ${delivery.id} permanently failed after ${delivery.attempts} attempts`);
      return;
    }

    // Update delivery record
    this.deliveries.set(delivery.id, delivery);

    // Emit retry event (would be handled by notification service)
    this.emitRetryEvent(delivery);
    
    logger.info(`Retrying delivery ${delivery.id} (attempt ${delivery.attempts})`);
  }

  /**
   * Emit retry event for notification service to handle
   */
  private emitRetryEvent(delivery: NotificationDelivery): void {
    // In a real implementation, this would emit an event or call the notification service
    // For now, we'll just log it
    logger.info(`Retry event emitted for delivery ${delivery.id}`);
  }

  /**
   * Get retry queue status
   */
  getRetryQueueStatus(): {
    queueLength: number;
    oldestRetry: Date | null;
    newestRetry: Date | null;
    averageAttempts: number;
  } {
    const queueLength = this.retryQueue.length;
    
    if (queueLength === 0) {
      return {
        queueLength: 0,
        oldestRetry: null,
        newestRetry: null,
        averageAttempts: 0
      };
    }

    const attempts = this.retryQueue.map(d => d.attempts);
    const lastAttempts = this.retryQueue.map(d => d.lastAttempt);
    
    return {
      queueLength,
      oldestRetry: new Date(Math.min(...lastAttempts.map(d => d.getTime()))),
      newestRetry: new Date(Math.max(...lastAttempts.map(d => d.getTime()))),
      averageAttempts: attempts.reduce((sum, a) => sum + a, 0) / attempts.length
    };
  }

  /**
   * Force retry all failed deliveries
   */
  async forceRetryAll(): Promise<number> {
    const failedDeliveries = this.getDeliveriesByStatus(DeliveryStatus.FAILED);
    let retried = 0;

    for (const delivery of failedDeliveries) {
      if (this.isRetryable(delivery)) {
        delivery.status = DeliveryStatus.RETRYING;
        this.addToRetryQueue(delivery);
        retried++;
      }
    }

    logger.info(`Force retry initiated for ${retried} failed deliveries`);
    return retried;
  }

  /**
   * Get delivery history for a notification
   */
  getDeliveryHistory(notificationId: string): {
    deliveries: NotificationDelivery[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      pending: number;
      totalAttempts: number;
    };
  } {
    const deliveries = this.getDeliveriesForNotification(notificationId);
    
    const summary = {
      total: deliveries.length,
      successful: deliveries.filter(d => 
        d.status === DeliveryStatus.DELIVERED || d.status === DeliveryStatus.SENT
      ).length,
      failed: deliveries.filter(d => d.status === DeliveryStatus.FAILED).length,
      pending: deliveries.filter(d => 
        d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.RETRYING
      ).length,
      totalAttempts: deliveries.reduce((sum, d) => sum + d.attempts, 0)
    };

    return { deliveries, summary };
  }
}

export const notificationDeliveryService = new NotificationDeliveryService();