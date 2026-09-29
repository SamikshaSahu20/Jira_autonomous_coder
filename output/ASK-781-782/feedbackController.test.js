const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const feedbackRoutes = require('./feedbackRoutes');
const Feedback = require('./Feedback');

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

describe('Feedback API', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/testdb');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await Feedback.deleteMany({});
  });

  test('should submit feedback successfully', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ name: 'John Doe', email: 'john@example.com', feedback: 'Great service!' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Feedback submitted successfully.');
  });

  test('should return error for missing fields', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ name: '', email: '', feedback: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('All fields are required.');
  });
});