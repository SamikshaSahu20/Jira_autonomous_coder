import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';

const ExpenseItem = ({ id, title, amount, date, onEdit, onDelete }) => {
  const handleEdit = useCallback(() => onEdit(id), [id, onEdit]);
  const handleDelete = useCallback(() => onDelete(id), [id, onDelete]);

  return (
    <motion.div
      className="expense-item"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="expense-item__details">
        <h3>{title}</h3>
        <p>${amount.toFixed(2)}</p>
        <p>{new Date(date).toLocaleDateString()}</p>
      </div>
      <div className="expense-item__actions">
        <button onClick={handleEdit} aria-label={`Edit expense ${title}`}>Edit</button>
        <button onClick={handleDelete} aria-label={`Delete expense ${title}`}>Delete</button>
      </div>
    </motion.div>
  );
};

ExpenseItem.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  amount: PropTypes.number.isRequired,
  date: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ExpenseItem;