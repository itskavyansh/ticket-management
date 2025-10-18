import { EventEmitter } from 'events';
import { getCacheService, CacheService } from './CacheService';
import { logger } from '../utils/logger';

export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  removeOnComplete: number;
  removeOnFail: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobProcessor<T = any> {
  (job: QueueJob<T>): Promise<any>;
}

export class QueueManagementService extends EventEmitter {
  private cache: CacheService;
  private queues: Map<string, QueueConfig> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private activeJobs: Map<string, Set<string>> = new Map();
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pausedQueues: Set<string> = new Set();

  constructor() {
    super();
    this.cache = getCacheService();
  }

  /**
   * Create a new queue
   */
  createQueue(config: QueueConfig): void {
    this.queues.set(config.name, config);
    this.activeJobs.set(config.name, new Set());
    
    logger.info('Queue created', { 
      name: config.name, 
      concurrency: config.concurrency 
    });

    // Start processing if not paused
    if (!this.pausedQueues.has(config.name)) {
      this.startProcessing(config.name);
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob<T>(
    queueName: string,
    jobType: string,
    data: T,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobId = this.generateJobId();
    const now = new Date();
    const processAt = new Date(now.getTime() + (options.delay || 0));

    const job: QueueJob<T> = {
      id: jobId,
      type: jobType,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || queue.maxRetries,
      delay: options.delay || 0,
      createdAt: now,
      processAt
    };

    // Store job in cache
    await this.storeJob(queueName, job);

    // Add to appropriate queue list
    if (options.delay && options.delay > 0) {
      await this.addToDelayedQueue(queueName, jobId, processAt);
    } else {
      await this.addToWaitingQueue(queueName, jobId, job.priority);
    }

    logger.debug('Job added to queue', {
      queueName,
      jobId,
      jobType,
      priority: job.priority,
      delay: options.delay
    });

    this.emit('job:added', { queueName, jobId, job });
    return jobId;
  }

  /**
   * Register a job processor
   */
  registerProcessor<T>(jobType: string, processor: JobProcessor<T>): void {
    this.processors.set(jobType, processor);
    logger.info('Job processor registered', { jobType });
  }

  /**
   * Start processing jobs in a queue
   */
  startProcessing(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (this.processingIntervals.has(queueName)) {
      return; // Already processing
    }

    const interval = setInterval(async () => {
      try {
        await this.processNextJobs(queueName);
      } catch (error) {
        logger.error('Queue processing error', { queueName, error });
      }
    }, 1000); // Check every second

    this.processingIntervals.set(queueName, interval);
    this.pausedQueues.delete(queueName);

    logger.info('Queue processing started', { queueName });
  }

  /**
   * Pause processing jobs in a queue
   */
  pauseQueue(queueName: string): void {
    const interval = this.processingIntervals.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(queueName);
    }

    this.pausedQueues.add(queueName);
    logger.info('Queue paused', { queueName });
  }

  /**
   * Resume processing jobs in a queue
   */
  resumeQueue(queueName: string): void {
    this.pausedQueues.delete(queueName);
    this.startProcessing(queueName);
    logger.info('Queue resumed', { queueName });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.getQueueLength(queueName, 'waiting'),
        this.getActiveJobCount(queueName),
        this.getQueueLength(queueName, 'completed'),
        this.getQueueLength(queueName, 'failed'),
        this.getQueueLength(queueName, 'delayed')
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: this.pausedQueues.has(queueName)
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { queueName, error });
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: this.pausedQueues.has(queueName)
      };
    }
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<QueueJob | null> {
    try {
      const cacheKey = `queue:${queueName}:job:${jobId}`;
      return await this.cache.get<QueueJob>(cacheKey);
    } catch (error) {
      logger.error('Failed to get job', { queueName, jobId, error });
      return null;
    }
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      // Remove from all possible queue states
      await Promise.all([
        this.removeFromQueue(queueName, 'waiting', jobId),
        this.removeFromQueue(queueName, 'delayed', jobId),
        this.removeFromQueue(queueName, 'completed', jobId),
        this.removeFromQueue(queueName, 'failed', jobId)
      ]);

      // Remove job data
      const cacheKey = `queue:${queueName}:job:${jobId}`;
      await this.cache.delete(cacheKey);

      logger.debug('Job removed', { queueName, jobId });
      return true;
    } catch (error) {
      logger.error('Failed to remove job', { queueName, jobId, error });
      return false;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(queueName: string): Promise<{ removed: number }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    let removed = 0;

    try {
      // Clean completed jobs
      const completedJobs = await this.getQueueJobs(queueName, 'completed');
      if (completedJobs.length > queue.removeOnComplete) {
        const toRemove = completedJobs.slice(0, completedJobs.length - queue.removeOnComplete);
        for (const jobId of toRemove) {
          await this.removeJob(queueName, jobId);
          removed++;
        }
      }

      // Clean failed jobs
      const failedJobs = await this.getQueueJobs(queueName, 'failed');
      if (failedJobs.length > queue.removeOnFail) {
        const toRemove = failedJobs.slice(0, failedJobs.length - queue.removeOnFail);
        for (const jobId of toRemove) {
          await this.removeJob(queueName, jobId);
          removed++;
        }
      }

      logger.info('Queue cleaned', { queueName, removed });
      return { removed };
    } catch (error) {
      logger.error('Failed to clean queue', { queueName, error });
      return { removed };
    }
  }

  /**
   * Process next jobs in the queue
   */
  private async processNextJobs(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || this.pausedQueues.has(queueName)) {
      return;
    }

    const activeJobs = this.activeJobs.get(queueName)!;
    const availableSlots = queue.concurrency - activeJobs.size;

    if (availableSlots <= 0) {
      return; // No available slots
    }

    // Move delayed jobs to waiting if their time has come
    await this.moveDelayedToWaiting(queueName);

    // Get next jobs to process
    const jobIds = await this.getNextJobs(queueName, availableSlots);

    for (const jobId of jobIds) {
      try {
        await this.processJob(queueName, jobId);
      } catch (error) {
        logger.error('Failed to start job processing', { queueName, jobId, error });
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      logger.warn('Job not found for processing', { queueName, jobId });
      return;
    }

    const processor = this.processors.get(job.type);
    if (!processor) {
      logger.error('No processor found for job type', { 
        queueName, 
        jobId, 
        jobType: job.type 
      });
      await this.failJob(queueName, job, 'No processor found');
      return;
    }

    // Mark job as active
    const activeJobs = this.activeJobs.get(queueName)!;
    activeJobs.add(jobId);

    // Remove from waiting queue
    await this.removeFromQueue(queueName, 'waiting', jobId);

    // Update job attempts
    job.attempts++;
    await this.storeJob(queueName, job);

    logger.debug('Processing job', { 
      queueName, 
      jobId, 
      jobType: job.type,
      attempt: job.attempts 
    });

    this.emit('job:active', { queueName, jobId, job });

    try {
      // Process the job
      const result = await processor(job);

      // Mark job as completed
      job.completedAt = new Date();
      await this.storeJob(queueName, job);
      await this.addToCompletedQueue(queueName, jobId);

      logger.debug('Job completed', { queueName, jobId, result });
      this.emit('job:completed', { queueName, jobId, job, result });

    } catch (error) {
      logger.error('Job processing failed', { 
        queueName, 
        jobId, 
        error: (error as Error).message,
        attempt: job.attempts 
      });

      if (job.attempts >= job.maxAttempts) {
        await this.failJob(queueName, job, (error as Error).message);
      } else {
        await this.retryJob(queueName, job);
      }
    } finally {
      // Remove from active jobs
      activeJobs.delete(jobId);
    }
  }

  /**
   * Fail a job
   */
  private async failJob(queueName: string, job: QueueJob, error: string): Promise<void> {
    job.failedAt = new Date();
    job.error = error;
    
    await this.storeJob(queueName, job);
    await this.addToFailedQueue(queueName, job.id);

    logger.warn('Job failed', { 
      queueName, 
      jobId: job.id, 
      error,
      attempts: job.attempts 
    });

    this.emit('job:failed', { queueName, jobId: job.id, job, error });
  }

  /**
   * Retry a job
   */
  private async retryJob(queueName: string, job: QueueJob): Promise<void> {
    const queue = this.queues.get(queueName)!;
    
    // Calculate retry delay
    let retryDelay = queue.retryDelay;
    
    switch (queue.backoffStrategy) {
      case 'exponential':
        retryDelay = Math.min(
          queue.retryDelay * Math.pow(2, job.attempts - 1),
          queue.maxRetryDelay
        );
        break;
      case 'linear':
        retryDelay = Math.min(
          queue.retryDelay * job.attempts,
          queue.maxRetryDelay
        );
        break;
      // 'fixed' uses the base retryDelay
    }

    job.processAt = new Date(Date.now() + retryDelay);
    await this.storeJob(queueName, job);
    await this.addToDelayedQueue(queueName, job.id, job.processAt);

    logger.debug('Job scheduled for retry', { 
      queueName, 
      jobId: job.id, 
      attempt: job.attempts,
      retryDelay,
      processAt: job.processAt
    });

    this.emit('job:retrying', { queueName, jobId: job.id, job, retryDelay });
  }

  /**
   * Store job data
   */
  private async storeJob(queueName: string, job: QueueJob): Promise<void> {
    const cacheKey = `queue:${queueName}:job:${job.id}`;
    await this.cache.set(cacheKey, job, { ttl: 86400 }); // 24 hours
  }

  /**
   * Add job to waiting queue (priority queue)
   */
  private async addToWaitingQueue(queueName: string, jobId: string, priority: number): Promise<void> {
    const cacheKey = `queue:${queueName}:waiting`;
    const score = -priority; // Negative for descending order (higher priority first)
    
    // Using sorted set simulation with cache
    const waitingJobs = await this.cache.get<Array<{ id: string; priority: number }>>(cacheKey) || [];
    waitingJobs.push({ id: jobId, priority });
    waitingJobs.sort((a, b) => b.priority - a.priority); // Sort by priority descending
    
    await this.cache.set(cacheKey, waitingJobs);
  }

  /**
   * Add job to delayed queue
   */
  private async addToDelayedQueue(queueName: string, jobId: string, processAt: Date): Promise<void> {
    const cacheKey = `queue:${queueName}:delayed`;
    const delayedJobs = await this.cache.get<Array<{ id: string; processAt: string }>>(cacheKey) || [];
    
    delayedJobs.push({ id: jobId, processAt: processAt.toISOString() });
    delayedJobs.sort((a, b) => new Date(a.processAt).getTime() - new Date(b.processAt).getTime());
    
    await this.cache.set(cacheKey, delayedJobs);
  }

  /**
   * Add job to completed queue
   */
  private async addToCompletedQueue(queueName: string, jobId: string): Promise<void> {
    const cacheKey = `queue:${queueName}:completed`;
    const completedJobs = await this.cache.get<string[]>(cacheKey) || [];
    completedJobs.unshift(jobId); // Add to front (most recent first)
    
    await this.cache.set(cacheKey, completedJobs);
  }

  /**
   * Add job to failed queue
   */
  private async addToFailedQueue(queueName: string, jobId: string): Promise<void> {
    const cacheKey = `queue:${queueName}:failed`;
    const failedJobs = await this.cache.get<string[]>(cacheKey) || [];
    failedJobs.unshift(jobId); // Add to front (most recent first)
    
    await this.cache.set(cacheKey, failedJobs);
  }

  /**
   * Move delayed jobs to waiting queue if their time has come
   */
  private async moveDelayedToWaiting(queueName: string): Promise<void> {
    const cacheKey = `queue:${queueName}:delayed`;
    const delayedJobs = await this.cache.get<Array<{ id: string; processAt: string }>>(cacheKey) || [];
    const now = new Date();
    
    const readyJobs: Array<{ id: string; processAt: string }> = [];
    const stillDelayed: Array<{ id: string; processAt: string }> = [];
    
    for (const delayedJob of delayedJobs) {
      if (new Date(delayedJob.processAt) <= now) {
        readyJobs.push(delayedJob);
      } else {
        stillDelayed.push(delayedJob);
      }
    }
    
    if (readyJobs.length > 0) {
      // Update delayed queue
      await this.cache.set(cacheKey, stillDelayed);
      
      // Move ready jobs to waiting queue
      for (const readyJob of readyJobs) {
        const job = await this.getJob(queueName, readyJob.id);
        if (job) {
          await this.addToWaitingQueue(queueName, readyJob.id, job.priority);
        }
      }
    }
  }

  /**
   * Get next jobs to process
   */
  private async getNextJobs(queueName: string, count: number): Promise<string[]> {
    const cacheKey = `queue:${queueName}:waiting`;
    const waitingJobs = await this.cache.get<Array<{ id: string; priority: number }>>(cacheKey) || [];
    
    const nextJobs = waitingJobs.slice(0, count);
    const remainingJobs = waitingJobs.slice(count);
    
    await this.cache.set(cacheKey, remainingJobs);
    
    return nextJobs.map(job => job.id);
  }

  /**
   * Get queue length
   */
  private async getQueueLength(queueName: string, queueType: string): Promise<number> {
    const cacheKey = `queue:${queueName}:${queueType}`;
    const jobs = await this.cache.get<any[]>(cacheKey) || [];
    return jobs.length;
  }

  /**
   * Get active job count
   */
  private getActiveJobCount(queueName: string): number {
    const activeJobs = this.activeJobs.get(queueName);
    return activeJobs ? activeJobs.size : 0;
  }

  /**
   * Get jobs in a queue
   */
  private async getQueueJobs(queueName: string, queueType: string): Promise<string[]> {
    const cacheKey = `queue:${queueName}:${queueType}`;
    
    if (queueType === 'waiting') {
      const jobs = await this.cache.get<Array<{ id: string; priority: number }>>(cacheKey) || [];
      return jobs.map(job => job.id);
    } else if (queueType === 'delayed') {
      const jobs = await this.cache.get<Array<{ id: string; processAt: string }>>(cacheKey) || [];
      return jobs.map(job => job.id);
    } else {
      return await this.cache.get<string[]>(cacheKey) || [];
    }
  }

  /**
   * Remove job from a specific queue
   */
  private async removeFromQueue(queueName: string, queueType: string, jobId: string): Promise<void> {
    const cacheKey = `queue:${queueName}:${queueType}`;
    
    if (queueType === 'waiting') {
      const jobs = await this.cache.get<Array<{ id: string; priority: number }>>(cacheKey) || [];
      const filtered = jobs.filter(job => job.id !== jobId);
      await this.cache.set(cacheKey, filtered);
    } else if (queueType === 'delayed') {
      const jobs = await this.cache.get<Array<{ id: string; processAt: string }>>(cacheKey) || [];
      const filtered = jobs.filter(job => job.id !== jobId);
      await this.cache.set(cacheKey, filtered);
    } else {
      const jobs = await this.cache.get<string[]>(cacheKey) || [];
      const filtered = jobs.filter(id => id !== jobId);
      await this.cache.set(cacheKey, filtered);
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup all queues and intervals
   */
  cleanup(): void {
    for (const interval of this.processingIntervals.values()) {
      clearInterval(interval);
    }
    
    this.processingIntervals.clear();
    this.activeJobs.clear();
    this.pausedQueues.clear();
    
    logger.info('Queue management service cleaned up');
  }
}

// Singleton queue management service
let queueManagementServiceInstance: QueueManagementService | null = null;

export const getQueueManagementService = (): QueueManagementService => {
  if (!queueManagementServiceInstance) {
    queueManagementServiceInstance = new QueueManagementService();
  }
  return queueManagementServiceInstance;
};