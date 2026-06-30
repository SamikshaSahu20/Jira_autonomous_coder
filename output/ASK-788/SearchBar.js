import React, { useState } from 'react';
import './SearchBar.module.css';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="searchBar">
      <input
        type="text"
        placeholder="Search for IT news..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input"
      />
      <button type="submit" className="button">Search</button>
    </form>
  );
}

export default SearchBar;