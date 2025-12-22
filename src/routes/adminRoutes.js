// src/routes/adminRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getStats,
  getAdminPosts,
  approvePost,
  rejectPost,
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser
} = require('../controllers/adminController');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('ADMIN'));

// ──────────────────────────────
// DASHBOARD & STATS
// ──────────────────────────────
router.get('/stats', getStats);

// ──────────────────────────────
// POST MANAGEMENT
// ──────────────────────────────
router.get('/posts', getAdminPosts);
router.put('/posts/:id/approve', approvePost);
router.put('/posts/:id/reject', rejectPost);

// ──────────────────────────────
// USER MANAGEMENT
// ──────────────────────────────
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;