const request = require('supertest');
const app = require('../server');
const Analytics = require('../models/Analytics');

jest.mock('../models/Analytics');

describe('GET /api/analytics', () => {
    it('returns analytics data', async () => {
        Analytics.find.mockResolvedValue([{ metricName: 'Test', value: 100, timestamp: new Date() }]);

        const res = await request(app).get('/api/analytics').set('Authorization', 'Bearer validToken');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([{ metricName: 'Test', value: 100, timestamp: expect.any(String) }]);
    });

    it('returns 500 on server error', async () => {
        Analytics.find.mockRejectedValue(new Error('Database error'));

        const res = await request(app).get('/api/analytics').set('Authorization', 'Bearer validToken');
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Failed to fetch analytics data');
    });
});