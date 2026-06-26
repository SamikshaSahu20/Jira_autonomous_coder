const request = require('supertest');
const express = require('express');
const thankYouPageRoutes = require('./thankYouPageRoutes');

const app = express();
app.use('/api/thank-you', thankYouPageRoutes);

describe('thankYouPageRoutes', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/thank-you/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Resource not found');
  });
});