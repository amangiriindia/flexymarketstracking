// src/routes/userRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle, handleMulterError } = require('../middleware/uploadMiddleware'); // ← NEW

const {
  getMyProfile,
  updateMyProfile,
  getUserStats,
  getMyPosts,
  getUserPublicProfile,
  getUserFollowers,
  getUserFollowing,
  getFollowStatus,
  getLoginHistory
} = require('../controllers/userController');

const {
  updateProfileValidation,
  userIdParam
} = require('../validators/userValidator');

const router = express.Router();

router.use(protect);

/**
 * USER PROFILE & STATS
 */
router.get('/me', getMyProfile);
router.put('/me', 
  uploadSingle,           // ← Accept avatar file
  handleMulterError,      // ← Handle upload errors
  updateProfileValidation, 
  updateMyProfile
);
router.get('/stats', getUserStats);
router.get('/my-posts', getMyPosts);

/**
 * PUBLIC USER PROFILE
 */
router.get('/profile/:userId', userIdParam, getUserPublicProfile);

/**
 * FOLLOW SYSTEM
 */
router.get('/followers', getUserFollowers);
router.get('/followers/:userId', userIdParam, getUserFollowers);
router.get('/following', getUserFollowing);
router.get('/following/:userId', userIdParam, getUserFollowing);
router.get('/follow-status/:userId', userIdParam, getFollowStatus);
router.get('/login-history', getLoginHistory);

module.exports = router;