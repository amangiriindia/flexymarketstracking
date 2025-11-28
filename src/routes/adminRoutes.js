// src/routes/adminRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getStats,
  getAdminPosts,
  approvePost,
  rejectPost
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/posts', getAdminPosts);
router.put('/posts/:id/approve', approvePost);
router.put('/posts/:id/reject', rejectPost);

module.exports = router;