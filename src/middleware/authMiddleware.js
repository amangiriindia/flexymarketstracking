// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Helper: Generate a random secure password
const generateRandomPassword = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  console.log('🔐 [AUTH] Protect middleware called for:', req.method, req.originalUrl);
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
      console.log('Decoded Token:', decoded); 
     
      // Get user data from token
      const tokenUserData = decoded.userData;
      
      if (!tokenUserData || !tokenUserData.email) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token structure - missing user data'
        });
      }

      // Try to find existing user by email
      let user = await User.findOne({ email: tokenUserData.email });
  
      // If user doesn't exist, auto-register them from the external server token data
      if (!user) {
        console.log('🆕 User not found in DB, auto-registering from external token...');
        
        try {
          // Extract user data from the decoded token
          const newUserData = {
            userName: tokenUserData.userName || `USER_${Date.now()}`,
            name: tokenUserData.name || tokenUserData.userName || 'Unknown',
            email: tokenUserData.email,
            phone: tokenUserData.mobile || tokenUserData.phone || null,
            password: generateRandomPassword(), // Generate random password since auth is via external token
            role: (tokenUserData.role && ['USER', 'ADMIN'].includes(tokenUserData.role.toUpperCase())) 
              ? tokenUserData.role.toUpperCase() 
              : 'USER',
            avatar: tokenUserData.profileImage || 'https://via.placeholder.com/150',
            isActive: true
          };

          user = await User.create(newUserData);
          
          console.log('✅ User auto-registered successfully:', {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role
          });
        } catch (createError) {
          console.error('❌ Auto-registration failed:', createError);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to auto-register user from external token'
          });
        }
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'Your account has been deactivated'
        });
      }

      // Attach user to request
      req.user = user;

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
