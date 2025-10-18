import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Middleware to capture raw body for webhook signature verification
export const captureRawBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.includes('/webhooks/')) {
    let data = '';
    
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
      data += chunk;
    });
    
    req.on('end', () => {
      try {
        // Store raw body for signature verification
        (req as any).rawBody = data;
        
        // Parse JSON body
        if (data) {
          req.body = JSON.parse(data);
        }
        
        next();
      } catch (error) {
        logger.error('Error parsing webhook body:', error);
        res.status(400).json({ error: 'Invalid JSON payload' });
      }
    });
  } else {
    next();
  }
};