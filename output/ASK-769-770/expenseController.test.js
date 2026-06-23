const request = require('supertest');
const app = require('../server');
const Expense = require('../models/Expense');

jest.mock('../models/Expense');

describe('Expense Controller', () => {
  it('should fetch all expenses', async () => {
    Expense.find.mockResolvedValue([{ title: 'Test', amount: 100, date: '2023-01-01' }]);
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ title: 'Test', amount: 100, date: '2023-01-01' }]);
  });

  it('should add a new expense', async () => {
    const newExpense = { title: 'Test', amount: 100, date: '2023-01-01' };
    Expense.prototype.save.mockResolvedValue(newExpense);
    const res = await request(app).post('/api/expenses').send(newExpense);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(newExpense);
  });

  it('should return error for missing fields in addExpense', async () => {
    const res = await request(app).post('/api/expenses').send({ title: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('All fields are required.');
  });

  it('should update an expense', async () => {
    const updatedExpense = { title: 'Updated Test', amount: 200, date: '2023-01-02' };
    Expense.findByIdAndUpdate.mockResolvedValue(updatedExpense);
    const res = await request(app).put('/api/expenses/1').send(updatedExpense);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updatedExpense);
  });

  it('should delete an expense', async () => {
    Expense.findByIdAndDelete.mockResolvedValue({ id: '1' });
    const res = await request(app).delete('/api/expenses/1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Expense deleted successfully');
  });
});