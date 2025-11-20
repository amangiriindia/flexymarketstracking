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
  getUserPosts
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const { uploadMultiple, handleMulterError } = require('../middleware/uploadMiddleware');
const { createPostValidation } = require('../validators/postValidator');

const router = express.Router();

// Public
router.get('/', getPosts);
router.get('/:id', getPost);
router.get('/user/:userId', getUserPosts);

// Protected
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

module.exports = router;