// src/routes/notificationRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  registerDeviceToken,
  deactivateDeviceToken,
  getMyNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  getMyDevices
} = require('../controllers/notificationController');

const {
  registerTokenValidation,
  deactivateTokenValidation,
  notificationIdParam,
  listNotificationsValidation
} = require('../validators/notificationValidator');

const { validate } = require('../middleware/validationMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * DEVICE TOKEN MANAGEMENT
 */
router.post('/register-token', 
  registerTokenValidation, 
  validate, 
  registerDeviceToken
);

router.post('/deactivate-token', 
  deactivateTokenValidation, 
  validate, 
  deactivateDeviceToken
);

router.get('/devices', getMyDevices);

/**
 * USER NOTIFICATIONS
 */
router.get('/', 
  listNotificationsValidation, 
  validate, 
  getMyNotifications
);

router.get('/stats', getNotificationStats);

router.get('/:id', 
  notificationIdParam, 
  validate, 
  getNotificationById
);

router.patch('/:id/read', 
  notificationIdParam, 
  validate, 
  markAsRead
);

router.patch('/read-all', markAllAsRead);

router.delete('/:id', 
  notificationIdParam, 
  validate, 
  deleteNotification
);

module.exports = router;