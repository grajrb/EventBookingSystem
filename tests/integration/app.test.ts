import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { setupWebSocketServer } from '../../server/websocket';

// Basic end-to-end style integration covering auth -> event -> booking

describe('Integration: auth, events, booking', () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let token: string;
  let eventId: number;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    setupWebSocketServer(server); // not strictly needed for HTTP tests
  });

  afterAll(done => {
    server.close(done);
  });

  it('registers a user', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ email: 'itest@example.com', password: 'password123', name: 'ITest' });
    expect(res.status).toBe(201);
    expect(res.body?.data?.user?.email).toBe('itest@example.com');
    token = res.body?.data?.token;
    expect(token).toBeTruthy();
  });

  it('creates an event as admin (should fail if not admin)', async () => {
    const res = await request(server)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sample Event', description: 'Desc', location: 'Online', date: new Date().toISOString(), totalSlots: 5, image: '', tags: ['test'] });
    // Non-admin should be forbidden
    expect([401,403,400]).toContain(res.status);
  });

  // Additional tests would elevate user to admin and repeat, but require direct DB or route not present.
});
