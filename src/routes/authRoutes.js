const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  registerAdmin,
  registerWithRole  
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  registerWithRoleValidation 
} = require('../validators/authValidator');

const router = express.Router();

// Public Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/register-admin', registerAdmin);
router.post('/register-with-role', registerWithRoleValidation, registerWithRole); // <-- New route

// Protected Routes
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfileValidation, updateProfile);

module.exports = router;