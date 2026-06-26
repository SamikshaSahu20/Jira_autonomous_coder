const { calculate } = require('./calculatorController');

describe('Calculator API', () => {
  test('should add two numbers', () => {
    const req = { body: { operand1: 5, operand2: 3, operation: '+' } };
    const res = { json: jest.fn() };
    calculate(req, res);
    expect(res.json).toHaveBeenCalledWith({ result: 8 });
  });

  test('should handle division by zero', () => {
    const req = { body: { operand1: 5, operand2: 0, operation: '/' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    calculate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error: Division by zero' });
  });

  test('should handle invalid operation', () => {
    const req = { body: { operand1: 5, operand2: 3, operation: '%' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    calculate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid operation.' });
  });

  test('should handle invalid input', () => {
    const req = { body: { operand1: 'a', operand2: 3, operation: '+' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    calculate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid input. Operands must be numbers.' });
  });
});