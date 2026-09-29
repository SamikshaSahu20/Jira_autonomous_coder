const Joi = require('joi');
const logger = require('./logger');

const envSchema = Joi.object({
  MONGO_URI: Joi.string().uri().required(),
  PORT: Joi.number().default(3000),
}).unknown();

exports.validateEnv = () => {
  const { error } = envSchema.validate(process.env);
  if (error) {
    logger.error(`Environment variable validation error: ${error.message}`);
    process.exit(1);
  }
};