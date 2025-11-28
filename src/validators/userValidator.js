// src/validators/userValidator.js
const { body, param } = require('express-validator');

/**
 * Validation for updating user profile
 */
exports.updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be 2-50 characters'),

  body('phone')
    .optional()
    .matches(/^[0-9]{10,15}$/)
    .withMessage('Phone number must be 10-15 digits'),

  body('avatar')
    .optional()
    .isURL({ require_protocol: true })
    .withMessage('Valid URL required for avatar')
];

/**
 * Validate MongoDB ObjectId for userId param
 */
exports.userIdParam = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];