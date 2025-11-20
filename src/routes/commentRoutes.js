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
const {
  createCommentValidation,
  commentIdParam
} = require('../validators/commentValidator');

const router = express.Router();

// Public
router.get('/post/:postId', getPostComments);
router.get('/:commentId/replies', getCommentReplies);

// Protected
router.post('/', protect, createCommentValidation, createComment);
router.put('/:id', protect, commentIdParam, updateComment);
router.delete('/:id', protect, commentIdParam, deleteComment);
router.post('/:id/like', protect, commentIdParam, likeComment);

module.exports = router;