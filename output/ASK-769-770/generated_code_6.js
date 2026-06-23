import React, { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

const ExpenseItem = ({ item }) => {
  const { theme } = useContext(ThemeContext);

  return (
    <li className={`expense-item ${theme}`}>
      {/* Item details */}
    </li>
  );
};

export default ExpenseItem;