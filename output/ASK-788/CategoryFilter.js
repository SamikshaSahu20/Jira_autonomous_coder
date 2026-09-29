import React from 'react';
import './CategoryFilter.module.css';

const categories = ['AI', 'Cloud Computing', 'Cybersecurity', 'Blockchain', 'Software Development'];

function CategoryFilter({ onFilter }) {
  return (
    <div className="filter">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onFilter(category)}
          className="button"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryFilter;