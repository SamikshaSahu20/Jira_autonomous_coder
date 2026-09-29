const calculate = (req, res) => {
  const { operand1, operand2, operation } = req.body;

  // Input validation
  if (typeof operand1 !== 'number' || typeof operand2 !== 'number') {
    return res.status(400).json({ error: 'Invalid input. Operands must be numbers.' });
  }

  const operations = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => (b === 0 ? 'Error: Division by zero' : a / b),
  };

  const calculateOperation = operations[operation];
  if (!calculateOperation) {
    return res.status(400).json({ error: 'Invalid operation.' });
  }

  const result = calculateOperation(operand1, operand2);
  if (result === 'Error: Division by zero') {
    return res.status(400).json({ error: result });
  }

  res.json({ result });
};

module.exports = { calculate };