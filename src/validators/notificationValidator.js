// src/validators/notificationValidator.js
const { body, param, query } = require('express-validator');

/**
 * Validate device token registration
 */
exports.registerTokenValidation = [
  body('token')
    .notEmpty()
    .withMessage('Device token is required')
    .isString()
    .withMessage('Token must be a string')
    .isLength({ min: 10, max: 500 })
    .withMessage('Token must be 10-500 characters'),

  body('deviceType')
    .notEmpty()
    .withMessage('Device type is required')
    .isIn(['android', 'ios', 'web'])
    .withMessage('Device type must be android, ios, or web'),

  body('deviceId')
    .optional()
    .isString()
    .withMessage('Device ID must be a string'),

  body('deviceName')
    .optional()
    .isString()
    .withMessage('Device name must be a string'),

  body('deviceModel')
    .optional()
    .isString()
    .withMessage('Device model must be a string'),

  body('osVersion')
    .optional()
    .isString()
    .withMessage('OS version must be a string'),

  body('appVersion')
    .optional()
    .isString()
    .withMessage('App version must be a string')
];

/**
 * Validate deactivate token request
 */
exports.deactivateTokenValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .isString()
    .withMessage('Token must be a string')
];

/**
 * Validate send notification to user
 */
exports.sendToUserValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),

  body('title')
    .notEmpty()
    .withMessage('Notification title is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),

  body('body')
    .notEmpty()
    .withMessage('Notification body is required')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Body must be 1-500 characters'),

  body('type')
    .optional()
    .isIn(['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'])
    .withMessage('Invalid notification type'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),

  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),

  body('imageUrl')
    .optional()
    .isURL({ require_protocol: true })
    .withMessage('Invalid image URL'),

  body('actions')
    .optional()
    .isArray()
    .withMessage('Actions must be an array')
];

/**
 * Validate send to multiple users
 */
exports.sendToMultipleValidation = [
  body('userIds')
    .notEmpty()
    .withMessage('User IDs are required')
    .isArray({ min: 1, max: 1000 })
    .withMessage('User IDs must be an array with 1-1000 items'),

  body('userIds.*')
    .isMongoId()
    .withMessage('Each user ID must be valid'),

  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),

  body('body')
    .notEmpty()
    .withMessage('Body is required')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Body must be 1-500 characters'),

  body('type')
    .optional()
    .isIn(['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'])
    .withMessage('Invalid notification type'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

/**
 * Validate broadcast notification
 */
exports.broadcastValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),

  body('body')
    .notEmpty()
    .withMessage('Body is required')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Body must be 1-500 characters'),

  body('type')
    .optional()
    .isIn(['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'])
    .withMessage('Invalid notification type'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

/**
 * Validate send by role
 */
exports.sendByRoleValidation = [
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['USER', 'ADMIN'])
    .withMessage('Invalid role'),

  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),

  body('body')
    .notEmpty()
    .withMessage('Body is required')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Body must be 1-500 characters')
];

/**
 * Validate schedule notification
 */
exports.scheduleNotificationValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),

  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters'),

  body('body')
    .notEmpty()
    .withMessage('Body is required')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Body must be 1-500 characters'),

  body('scheduledFor')
    .notEmpty()
    .withMessage('Scheduled time is required')
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value) => {
      const scheduledDate = new Date(value);
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      return true;
    })
];

/**
 * Validate notification ID param
 */
exports.notificationIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid notification ID format')
];

/**
 * Validate query parameters for listing notifications
 */
exports.listNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('type')
    .optional()
    .isIn(['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'])
    .withMessage('Invalid notification type'),

  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'failed', 'read'])
    .withMessage('Invalid delivery status'),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

/**
 * Validate query parameters for admin listing
 */
exports.adminListValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('type')
    .optional()
    .isIn(['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'])
    .withMessage('Invalid notification type'),

  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'failed', 'read'])
    .withMessage('Invalid delivery status'),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),

  query('sentBy')
    .optional()
    .isMongoId()
    .withMessage('Invalid sender ID'),

  query('recipient')
    .optional()
    .isMongoId()
    .withMessage('Invalid recipient ID'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid ISO 8601 date')
];