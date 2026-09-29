const path = require('path');
const logger = require('./logger');

exports.getThankYouPage = async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, 'index.html');
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error serving file: ${err.message}`);
        next(err);
      }
    });
  } catch (error) {
    logger.error(`Unexpected error: ${error.message}`);
    next(error);
  }
};