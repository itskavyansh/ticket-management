import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import { HealthService } from '../../services/HealthService';
import { MetricsCollectionService } from '../../services/MetricsCollectionService';

describe('Integration: Health Monitoring and Metrics Collection', () => {
  let app: any;
  let server: Server;
  let healthService: HealthService;
  let metricsService: MetricsCollectionService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    server = app.listen(0);
    
    healthService = new HealthService();
    metricsService = new MetricsCollectionService();
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Basic Health Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('services');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      expect(typeof response.body.uptime).toBe('number');
      expect(Array.isArray(response.body.services)).toBe(true);
    });

    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body).toHaveProperty('systemInfo');

      expect(response.body.systemInfo).toHaveProperty('nodeVersion');
      expect(response.body.systemInfo).toHaveProperty('platform');
      expect(response.body.systemInfo).toHaveProperty('memory');
      expect(response.body.systemInfo).toHaveProperty('cpuUsage');

      expect(Array.isArray(response.body.services)).toBe(true);
      expect(Array.isArray(response.body.dependencies)).toBe(true);
    });

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready');

      // Response can be 200 (ready) or 503 (not ready)
      expect([200, 503]).toContain(response.status);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');

      expect(['ready', 'not_ready']).toContain(response.body.status);
      expect(Array.isArray(response.body.checks)).toBe(true);

      // Verify check structure
      if (response.body.checks.length > 0) {
        const check = response.body.checks[0];
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(['pass', 'fail']).toContain(check.status);
      }
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live');

      // Response can be 200 (alive) or 503 (not alive)
      expect([200, 503]).toContain(response.status);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');

      if (response.status === 200) {
        expect(response.body.status).toBe('alive');
        expect(response.body).toHaveProperty('uptime');
      } else {
        expect(response.body.status).toBe('not_alive');
        expect(response.body).toHaveProperty('reason');
      }
    });
  });

  describe('Service-Specific Health Checks', () => {
    it('should check database health', async () => {
      const response = await request(app)
        .get('/health/database');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('databases');

      expect(['healthy', 'unhealthy']).toContain(response.body.status);
      expect(Array.isArray(response.body.databases)).toBe(true);

      if (response.body.databases.length > 0) {
        const db = response.body.databases[0];
        expect(db).toHaveProperty('name');
        expect(db).toHaveProperty('type');
        expect(db).toHaveProperty('status'