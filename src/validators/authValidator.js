// src/validators/authValidator.js
const { body } = require('express-validator');




exports.registerWithRoleValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9]{10,15}$/).withMessage('Please provide a valid phone number (10-15 digits)'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  
  body('role')
    .optional()
    .isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin"')
];


exports.registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .matches(/^[0-9]{10,15}$/)
    .withMessage('Phone number must be 10-15 digits'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  body('deviceInfo')
    .optional()
    .isString().withMessage('Device info must be a string')
    .trim(),
  
  body('locationInfo')
    .optional()
    .isObject().withMessage('Location info must be an object'),
  
  body('locationInfo.country')
    .optional()
    .isString().withMessage('Country must be a string'),
  
  body('locationInfo.state')
    .optional()
    .isString().withMessage('State must be a string'),
  
  body('locationInfo.city')
    .optional()
    .isString().withMessage('City must be a string'),
  
  body('locationInfo.pincode')
    .optional()
    .isString().withMessage('Pincode must be a string'),
  
  body('locationInfo.formattedAddress')
    .optional()
    .isString().withMessage('Formatted address must be a string'),
  
  body('locationInfo.lat')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  
  body('locationInfo.lng')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
];

exports.updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone')
    .optional()
    .matches(/^[0-9]{10,15}$/)
    .withMessage('Invalid phone number')
];