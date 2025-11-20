// src/routes/authRoutes.js
const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation
} = require('../validators/authValidator');

const router = express.Router();

// Public Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected Routes
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfileValidation, updateProfile);

module.exports = router;