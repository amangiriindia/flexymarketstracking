// src/routes/adminNotificationRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  broadcastNotification,
  sendNotificationByRole,
  scheduleNotification,
  getAllNotifications,
  getNotificationStats,
  getAllDeviceTokens,
  deleteNotification,
  retryFailedNotification
} = require('../controllers/adminNotificationController');

const {
  sendToUserValidation,
  sendToMultipleValidation,
  broadcastValidation,
  sendByRoleValidation,
  scheduleNotificationValidation,
  notificationIdParam,
  adminListValidation
} = require('../validators/notificationValidator');

const { validate } = require('../middleware/validationMiddleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('ADMIN'));

/**
 * SEND NOTIFICATIONS
 */
router.post('/send', 
  sendToUserValidation, 
  validate, 
  sendNotificationToUser
);

router.post('/send-multiple', 
  sendToMultipleValidation, 
  validate, 
  sendNotificationToMultipleUsers
);

router.post('/broadcast', 
  broadcastValidation, 
  validate, 
  broadcastNotification
);

router.post('/send-by-role', 
  sendByRoleValidation, 
  validate, 
  sendNotificationByRole
);

router.post('/schedule', 
  scheduleNotificationValidation, 
  validate, 
  scheduleNotification
);

/**
 * NOTIFICATION MANAGEMENT
 */
router.get('/', 
  adminListValidation, 
  validate, 
  getAllNotifications
);

router.get('/stats', getNotificationStats);

router.delete('/:id', 
  notificationIdParam, 
  validate, 
  deleteNotification
);

router.post('/:id/retry', 
  notificationIdParam, 
  validate, 
  retryFailedNotification
);

/**
 * DEVICE TOKEN MANAGEMENT
 */
router.get('/devices', getAllDeviceTokens);

module.exports = router;