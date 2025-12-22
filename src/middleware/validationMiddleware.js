// src/middleware/validationMiddleware.js
const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: extractedErrors
    });
  }
  
  next();
};