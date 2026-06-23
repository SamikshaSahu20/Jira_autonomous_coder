import React, { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

const ExpenseList = () => {
  const { theme } = useContext(ThemeContext);

  return (
    <ul className={`expense-list ${theme}`}>
      {/* List items */}
    </ul>
  );
};

export default ExpenseList;