const logger = require('./logger');

module.exports = (err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: 'An unexpected error occurred. Please try again later.',
  });
};