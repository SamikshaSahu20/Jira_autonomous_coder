const Expense = require('../models/Expense');

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expenses. Please try again later.' });
  }
};

exports.addExpense = async (req, res) => {
  const { title, amount, date } = req.body;
  if (!title || !amount || !date) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    const expense = new Expense({ title, amount, date });
    const savedExpense = await expense.save();
    res.status(201).json(savedExpense);
  } catch (error) {
    res.status(400).json({ message: 'Failed to add expense. Please check your input.' });
  }
};

exports.updateExpense = async (req, res) => {
  const { title, amount, date } = req.body;
  if (!title || !amount || !date) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      { title, amount, date },
      { new: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    res.status(200).json(updatedExpense);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update expense. Please check your input.' });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
    if (!deletedExpense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete expense. Please try again later.' });
  }
};