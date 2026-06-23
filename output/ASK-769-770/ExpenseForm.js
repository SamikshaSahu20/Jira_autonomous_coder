import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ExpenseForm = ({ onSubmit, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [date, setDate] = useState(initialData?.date || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseFloat(amount) <= 0) {
      alert('Amount must be greater than zero.');
      return;
    }
    onSubmit({ title, amount: parseFloat(amount), date });
    setTitle('');
    setAmount('');
    setDate('');
  };

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setAmount(initialData.amount);
      setDate(initialData.date);
    }
  }, [initialData]);

  return (
    <form onSubmit={handleSubmit} className="expense-form">
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

ExpenseForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    title: PropTypes.string,
    amount: PropTypes.number,
    date: PropTypes.string,
  }),
};

export default ExpenseForm;