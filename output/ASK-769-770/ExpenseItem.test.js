import { render, screen, fireEvent } from '@testing-library/react';
import ExpenseItem from '../components/ExpenseItem';

test('renders expense item with correct details', () => {
  render(
    <ExpenseItem
      id="1"
      title="Test Expense"
      amount={100}
      date="2023-01-01"
      onEdit={jest.fn()}
      onDelete={jest.fn()}
    />
  );

  expect(screen.getByText('Test Expense')).toBeInTheDocument();
  expect(screen.getByText('$100.00')).toBeInTheDocument();
  expect(screen.getByText('1/1/2023')).toBeInTheDocument();
});

test('calls onEdit when edit button is clicked', () => {
  const onEdit = jest.fn();
  render(
    <ExpenseItem
      id="1"
      title="Test Expense"
      amount={100}
      date="2023-01-01"
      onEdit={onEdit}
      onDelete={jest.fn()}
    />
  );

  fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalledWith('1');
});

test('calls onDelete when delete button is clicked', () => {
  const onDelete = jest.fn();
  render(
    <ExpenseItem
      id="1"
      title="Test Expense"
      amount={100}
      date="2023-01-01"
      onEdit={jest.fn()}
      onDelete={onDelete}
    />
  );

  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalledWith('1');
});