const request = require('supertest');
const app = require('./app');

describe('Weather Controller', () => {
  it('should return weather data with status 200', async () => {
    const res = await request(app).get('/api/weather');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        region: 'Region 1',
        temperature: [23, 25, 22, 24],
        humidity: [60, 65, 58, 62],
        rainfall: [10, 12, 8, 15],
      },
      {
        region: 'Region 2',
        temperature: [30, 32, 29, 31],
        humidity: [55, 58, 54, 57],
        rainfall: [5, 7, 6, 8],
      },
      {
        region: 'Region 3',
        temperature: [18, 20, 19, 21],
        humidity: [70, 75, 72, 74],
        rainfall: [20, 25, 18, 22],
      },
    ]);
  });
});