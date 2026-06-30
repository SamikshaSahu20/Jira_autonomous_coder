import React from 'react';
import './NewsCard.module.css';

function NewsCard({ article }) {
  return (
    <div className="card">
      <img src={article.urlToImage} alt={article.title} className="image" />
      <div className="content">
        <h2 className="title">{article.title}</h2>
        <p className="description">{article.description}</p>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="link">
          Read more
        </a>
      </div>
    </div>
  );
}

export default NewsCard;