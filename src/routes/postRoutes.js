// src/routes/postRoutes.js
const express = require('express');
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
  voteOnPoll,
  getUserPosts,
  getMyPosts,    // ← Make sure this is imported!
  sharePost
} = require('../controllers/postController');

const { protect } = require('../middleware/authMiddleware');
const { uploadMultiple, handleMulterError } = require('../middleware/uploadMiddleware');
const { createPostValidation } = require('../validators/postValidator');

const router = express.Router();

// ──────────────────────────────
// IMPORTANT: Specific routes FIRST!
// ──────────────────────────────
router.get('/my-posts', protect, getMyPosts);           // ← MUST be BEFORE /:id
router.get('/user/:userId', getUserPosts);

// Public routes
router.get('/', getPosts);

// This must come AFTER all specific routes!
router.get('/:id', getPost);                            // ← Now safe

// Protected routes
router.post(
  '/',
  protect,
  uploadMultiple,
  handleMulterError,
  createPostValidation,
  createPost
);

router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/vote', protect, voteOnPoll);
router.post('/:id/share', protect, sharePost);

module.exports = router;