import React, { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

const ExpenseForm = () => {
  const { theme } = useContext(ThemeContext);

  return (
    <form className={`expense-form ${theme}`}>
      {/* Form fields */}
    </form>
  );
};

export default ExpenseForm;