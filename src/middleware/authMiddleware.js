// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route. Please login.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded Token:', decoded); // Debug
     
      // Get user from token
      req.user = await User.findOne({email: decoded.userData.email});
  
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'Your account has been deactivated'
        });
      }

      console.log('User found:', {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        roleType: typeof req.user.role
      }); // Debug

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        status: 'error',
        message: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Normalize to uppercase for comparison
    const normalizedRoles = roles.map(role => role.toUpperCase());
    const userRole = req.user.role.toUpperCase();
    
    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};
