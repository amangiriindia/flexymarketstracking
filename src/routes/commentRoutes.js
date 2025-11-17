// src/routes/commentRoutes.js
const express = require('express');
const {
  createComment,
  getPostComments,
  getCommentReplies,
  updateComment,
  deleteComment,
  likeComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/post/:postId', getPostComments);
router.get('/:commentId/replies', getCommentReplies);

// Protected routes
router.post('/', protect, createComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);
router.post('/:id/like', protect, likeComment);

module.exports = router;