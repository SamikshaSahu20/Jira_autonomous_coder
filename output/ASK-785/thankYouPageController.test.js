const request = require('supertest');
const express = require('express');
const { getThankYouPage } = require('./thankYouPageController');

const app = express();
app.get('/', getThankYouPage);

describe('thankYouPageController', () => {
  it('should serve the thank you page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Thank You Team</title>');
  });

  it('should handle errors when the file is not found', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    console.error.mockRestore();
  });
});