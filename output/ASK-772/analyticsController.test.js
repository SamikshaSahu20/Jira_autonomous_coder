import request from 'supertest';
import express from 'express';
import analyticsController from './analyticsController';

const app = express();
app.use('/analytics', analyticsController);

test('GET /analytics returns analytics data', async () => {
  const response = await request(app).get('/analytics');
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('cropYield');
  expect(response.body).toHaveProperty('weatherPatterns');
  expect(response.body).toHaveProperty('financialMetrics');
});