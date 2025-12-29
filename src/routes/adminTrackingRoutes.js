// src/routes/adminTrackingRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getActiveSessions,
  getAllSessions,
  getSessionDetail,
  getScreenAnalytics,
  getUserBehaviorAnalytics,
  getUserJourney,
  getScreenSpecificAnalytics,
  getAdminDashboardStats  // ← Add this import
} = require('../controllers/adminTrackingController');

const {
  sessionIdParam,
  userIdParam,
  screenNameParam
} = require('../validators/trackingValidator');

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(authorize('ADMIN'));

/**
 * DASHBOARD STATS (Add this at the top for easy access)
 */
router.get('/stats/dashboard', getAdminDashboardStats);

/**
 * SESSION MONITORING
 */
router.get('/sessions/active', getActiveSessions);
router.get('/sessions', getAllSessions);
router.get('/sessions/:sessionId', sessionIdParam, getSessionDetail);

/**
 * USER JOURNEY & BEHAVIOR
 */
router.get('/users/:userId/journey', userIdParam, getUserJourney);

/**
 * ANALYTICS & INSIGHTS
 */
router.get('/analytics/screens', getScreenAnalytics);
router.get('/analytics/users', getUserBehaviorAnalytics);
router.get('/screens/:screenName/analytics', screenNameParam, getScreenSpecificAnalytics);

module.exports = router;