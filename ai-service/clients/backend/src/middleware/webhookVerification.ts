import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Middleware to verify Slack webhook signatures
 */
export const verifySlackWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    
    if (!slackSigningSecret) {
      logger.warn('SLACK_SIGNING_SECRET not configured, skipping verification');
      next();
      return;
    }

    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;
    
    if (!timestamp || !signature) {
      logger.warn('Missing Slack signature headers');
      res.status(401).json({ error: 'Missing signature headers' });
      return;
    }

    // Check if request is too old (replay attack protection)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      logger.warn('Slack request timestamp too old');
      res.status(401).json({ error: 'Request timestamp too old' });
      return;
    }

    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    // Verify signature
    const baseString = `v0:${timestamp}:${rawBody}`;
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', slackSigningSecret)
      .update(baseString)
      .digest('hex')}`;

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Invalid Slack signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error verifying Slack webhook:', error);
    res.status(500).json({ error: 'Webhook verification failed' });
  }
};

/**
 * Middleware to verify Microsoft Teams webhook signatures
 */
export const verifyTeamsWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Teams webhook verification would depend on your bot framework setup
    // For now, we'll skip verification but log the request
    logger.info('Teams webhook received', {
      headers: req.headers,
      body: req.body
    });
    
    next();
  } catch (error) {
    logger.error('Error verifying Teams webhook:', error);
    res.status(500).json({ error: 'Webhook verification failed' });
  }
};

/**
 * Middleware to capture raw body for signature verification
 */
export const captureRawBody = (req: Request, res: Response, next: NextFunction): void => {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    (req as any).rawBody = data;
    next();
  });
};

/**
 * Rate limiting middleware for webhook endpoints
 */
export const webhookRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of requests.entries()) {
      if (now > value.resetTime) {
        requests.delete(key);
      }
    }
    
    // Get or create client entry
    let clientData = requests.get(clientId);
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs };
      requests.set(clientId, clientData);
    }
    
    // Check rate limit
    if (clientData.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for webhook client: ${clientId}`);
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
      return;
    }
    
    // Increment counter
    clientData.count++;
    
    next();
  };
};