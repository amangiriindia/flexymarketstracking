// src/routes/trackingRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  startSession,
  trackScreen,
  updateScreenActivity,
  endSession,
  getCurrentSession,
  getMySessions
} = require('../controllers/trackingController');

const {
  startSessionValidation,
  trackScreenValidation,
  updateActivityValidation,
  endSessionValidation
} = require('../validators/trackingValidator');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * SESSION MANAGEMENT
 */
router.post('/session/start', startSessionValidation, startSession);
router.post('/session/end', endSessionValidation, endSession);
router.get('/session/current', getCurrentSession);
router.get('/sessions', getMySessions);

/**
 * SCREEN TRACKING
 */
router.post('/screen', trackScreenValidation, trackScreen);
router.put('/screen/:activityId', updateActivityValidation, updateScreenActivity);

module.exports = router;