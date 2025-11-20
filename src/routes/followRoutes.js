// src/routes/followRoutes.js
const express = require('express');
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
} = require('../controllers/followController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// ──────────────────────────────
// Follow & Unfollow (required userId)
// ──────────────────────────────
router.post('/:userId', followUser);
router.delete('/:userId', unfollowUser);

// ──────────────────────────────
// Followers & Following (userId optional)
// ──────────────────────────────
// Use a separate route for the case without param
router.get('/followers', getFollowers);                    // My followers
router.get('/followers/:userId', getFollowers);            // Someone's followers

router.get('/following', getFollowing);                    // Who I follow
router.get('/following/:userId', getFollowing);            // Who someone follows

// ──────────────────────────────
// Follow status (required userId)
// ──────────────────────────────
router.get('/status/:userId', getFollowStatus);

module.exports = router;