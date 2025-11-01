import { s3, s3Config } from '../config/aws';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
}

export interface DownloadResult {
  body: Buffer;
  contentType: string;
  lastModified: Date;
}

export class S3Service {
  private bucketName: string;
  private isAWSConfigured: boolean;

  constructor() {
    this.bucketName = s3Config.bucketName;
    this.isAWSConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    if (!this.isAWSConfigured) {
      logger.warn('AWS credentials not configured. S3 operations will be simulated locally.');
    }
  }

  private checkAWSConfiguration(): void {
    if (!this.isAWSConfigured) {
      throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
    }
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    folder?: string
  ): Promise<UploadResult> {
    if (!this.isAWSConfigured) {
      // Simulate upload for local development
      const key = folder ? `${folder}/${uuidv4()}-${fileName}` : `${uuidv4()}-${fileName}`;
      logger.info(`[SIMULATED] File upload to S3: ${key}`);
      
      return {
        key,
        url: `https://localhost:3000/api/storage/local/${key}`,
        bucket: this.bucketName,
        size: file.length
      };
    }

    try {
      const key = folder ? `${folder}/${uuidv4()}-${fileName}` : `${uuidv4()}-${fileName}`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      };

      const result = await s3.upload(params).promise();
      
      logger.info(`File uploaded to S3: ${key}`);
      
      return {
        key,
        url: result.Location,
        bucket: this.bucketName,
        size: file.length
      };
    } catch (error) {
      logger.error('S3 upload failed:', error);
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  /**
   * Download file from S3
   */
  async downloadFile(key: string): Promise<DownloadResult> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const result = await s3.getObject(params).promise();
      
      return {
        body: result.Body as Buffer,
        contentType: result.ContentType || 'application/octet-stream',
        lastModified: result.LastModified || new Date()
      };
    } catch (error) {
      logger.error('S3 download failed:', error);
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }

  /**
   * Generate signed URL for file access
   */
  async getSignedUrl(key: string, expires: number = s3Config.signedUrlExpiry): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expires
      };

      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      logger.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await s3.deleteObject(params).promise();
      logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
      logger.error('S3 delete failed:', error);
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folder?: string, maxKeys: number = 100): Promise<string[]> {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: folder ? `${folder}/` : undefined,
        MaxKeys: maxKeys
      };

      const result = await s3.listObjectsV2(params).promise();
      return result.Contents?.map(obj => obj.Key || '') || [];
    } catch (error) {
      logger.error('S3 list failed:', error);
      throw new Error(`Failed to list files: ${(error as Error).message}`);
    }
  }

  /**
   * Upload log file
   */
  async uploadLog(logContent: string, logType: string): Promise<UploadResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${logType}-${timestamp}.log`;
    const buffer = Buffer.from(logContent, 'utf8');
    
    return this.uploadFile(buffer, fileName, 'text/plain', 'logs');
  }

  /**
   * Upload report file
   */
  async uploadReport(reportData: any, reportType: string, format: 'json' | 'csv' = 'json'): Promise<UploadResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportType}-${timestamp}.${format}`;
    
    let content: string;
    let contentType: string;
    
    if (format === 'json') {
      content = JSON.stringify(reportData, null, 2);
      contentType = 'application/json';
    } else {
      // Simple CSV conversion for basic reports
      content = this.convertToCSV(reportData);
      contentType = 'text/csv';
    }
    
    const buffer = Buffer.from(content, 'utf8');
    return this.uploadFile(buffer, fileName, contentType, 'reports');
  }

  /**
   * Upload knowledge base document
   */
  async uploadKnowledgeBase(content: string, title: string, category: string): Promise<UploadResult> {
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    const buffer = Buffer.from(content, 'utf8');
    
    return this.uploadFile(buffer, fileName, 'text/markdown', `knowledge-base/${category}`);
  }

  /**
   * Simple CSV converter for basic data
   */
  private convertToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Check if bucket exists and create if needed
   */
  async ensureBucketExists(): Promise<void> {
    if (!this.isAWSConfigured) {
      logger.info(`[SIMULATED] S3 bucket ${this.bucketName} ready (local mode)`);
      return;
    }

    try {
      await s3.headBucket({ Bucket: this.bucketName }).promise();
      logger.info(`S3 bucket ${this.bucketName} exists`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.info(`Creating S3 bucket: ${this.bucketName}`);
        await s3.createBucket({ 
          Bucket: this.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: s3Config.region !== 'us-east-1' ? s3Config.region : undefined
          }
        }).promise();
        logger.info(`S3 bucket ${this.bucketName} created`);
      } else {
        throw error;
      }
    }
  }
}

export const s3Service = new S3Service();