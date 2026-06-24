const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Feedback = require('./Feedback');
const apiRoutes = require('./api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Feedback API', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/test', { useNewUrlParser: true });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await Feedback.deleteMany({});
  });

  it('should submit feedback successfully', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ name: 'John Doe', email: 'john@example.com', productName: 'Product A', message: 'Great product!' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Feedback submitted successfully');
  });

  it('should return error for missing fields', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ name: 'John Doe', email: 'john@example.com', productName: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('All fields are required');
  });

  it('should return error for invalid email', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ name: 'John Doe', email: 'invalid-email', productName: 'Product A', message: 'Great product!' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid email format');
  });
});