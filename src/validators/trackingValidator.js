// src/validators/trackingValidator.js
const { body, param, query } = require('express-validator');

/**
 * Validation for starting a session
 */
exports.startSessionValidation = [
  body('device').optional().isObject().withMessage('Device must be an object'),
  body('device.type')
    .optional()
    .isIn(['mobile', 'tablet', 'desktop', 'unknown'])
    .withMessage('Invalid device type'),
  body('device.name').optional().isString().trim(),
  body('device.os').optional().isString().trim(),
  body('device.osVersion').optional().isString().trim(),
  body('device.browser').optional().isString().trim(),
  body('device.browserVersion').optional().isString().trim(),
  body('device.model').optional().isString().trim(),
  body('device.manufacturer').optional().isString().trim(),
  body('device.appVersion').optional().isString().trim(),

  body('location').optional().isObject().withMessage('Location must be an object'),
  body('location.country').optional().isString().trim(),
  body('location.countryCode').optional().isString().trim().isLength({ min: 2, max: 2 }),
  body('location.state').optional().isString().trim(),
  body('location.city').optional().isString().trim(),
  body('location.pincode').optional().isString().trim(),
  body('location.formattedAddress').optional().isString().trim(),
  body('location.timezone').optional().isString().trim(),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  body('location.accuracy').optional().isFloat({ min: 0 }),

  body('fcmToken').optional().isString().trim(),
  body('language').optional().isString().trim().isLength({ min: 2, max: 10 }),
  body('referrer').optional().isString().trim()
];

/**
 * Validation for tracking screen
 */
exports.trackScreenValidation = [
  body('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID'),

  body('screenName')
    .notEmpty().withMessage('Screen name is required')
    .isIn([
      'login', 'home', 'profile', 'settings', 'trading', 'wallet', 
      'metalist', 'notifications', 'search', 'post_detail', 'post_create', 
      'post_edit', 'user_profile', 'followers', 'following', 'chat', 
      'video_call', 'live_stream', 'explore', 'bookmarks', 'analytics', 
      'help', 'about', 'terms', 'privacy', 'logout'
    ])
    .withMessage('Invalid screen name'),

  body('screenRoute').optional().isString().trim(),
  body('screenTitle').optional().isString().trim(),
  body('previousScreen').optional().isString().trim(),

  body('navigationMethod')
    .optional()
    .isIn(['tap', 'swipe', 'back_button', 'deep_link', 'notification', 'auto'])
    .withMessage('Invalid navigation method'),

  body('deviceState').optional().isObject(),
  body('deviceState.batteryLevel').optional().isFloat({ min: 0, max: 100 }),
  body('deviceState.networkType')
    .optional()
    .isIn(['wifi', '4g', '5g', '3g', '2g', 'offline'])
    .withMessage('Invalid network type'),
  body('deviceState.orientation')
    .optional()
    .isIn(['portrait', 'landscape'])
    .withMessage('Invalid orientation'),
  body('deviceState.screenBrightness').optional().isFloat({ min: 0, max: 100 }),

  body('location').optional().isObject(),
  body('location.country').optional().isString().trim(),
  body('location.state').optional().isString().trim(),
  body('location.city').optional().isString().trim(),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),

  body('loadTime').optional().isInt({ min: 0 }).withMessage('Load time must be positive'),
  body('referrer').optional().isString().trim(),
  body('metadata').optional().isObject()
];

/**
 * Validation for updating screen activity
 */
exports.updateActivityValidation = [
  param('activityId')
    .isMongoId()
    .withMessage('Invalid activity ID'),

  body('scrollDepth')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Scroll depth must be between 0 and 100'),

  body('action').optional().isObject(),
  body('action.type')
    .optional()
    .isIn(['click', 'scroll', 'swipe', 'type', 'submit', 'share', 'like', 'comment', 'view'])
    .withMessage('Invalid action type'),
  body('action.target').optional().isString().trim(),
  body('action.metadata').optional().isObject(),

  body('apiCalls')
    .optional()
    .isInt({ min: 0 })
    .withMessage('API calls must be positive')
];

/**
 * Validation for ending session
 */
exports.endSessionValidation = [
  body('sessionId')
    .notEmpty().withMessage('Session ID is required')
    .isMongoId().withMessage('Invalid session ID')
];

/**
 * Validation for MongoDB ObjectId params
 */
exports.sessionIdParam = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID')
];

exports.userIdParam = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
];

exports.screenNameParam = [
  param('screenName')
    .notEmpty()
    .withMessage('Screen name is required')
    .isIn([
      'login', 'home', 'profile', 'settings', 'trading', 'wallet', 
      'metalist', 'notifications', 'search', 'post_detail', 'post_create', 
      'post_edit', 'user_profile', 'followers', 'following', 'chat', 
      'video_call', 'live_stream', 'explore', 'bookmarks', 'analytics', 
      'help', 'about', 'terms', 'privacy', 'logout'
    ])
    .withMessage('Invalid screen name')
];

/**
 * Query validation for filtering
 */
exports.dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
];

exports.filterValidation = [
  query('country').optional().isString().trim(),
  query('city').optional().isString().trim(),
  query('deviceType')
    .optional()
    .isIn(['mobile', 'tablet', 'desktop', 'unknown'])
    .withMessage('Invalid device type'),
  query('os').optional().isString().trim(),
  query('status')
    .optional()
    .isIn(['active', 'idle', 'expired', 'logged_out'])
    .withMessage('Invalid status')
];