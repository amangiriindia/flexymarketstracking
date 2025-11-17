// src/routes/voiceCallRoutes.js
const express = require('express');
const {
  initiateCall,
  userToUserCall,
  answerCall,
  endCall,
  rejectCall,
  getCallHistory,
  getCallDetails
} = require('../controllers/voiceCallController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected routes - all require authentication
router.use(protect);

// Admin to User call (Admin only)
router.post('/initiate', authorize('admin'), initiateCall);

// User to User call
router.post('/user-call', userToUserCall);

// Call actions
router.post('/:callId/answer', answerCall);
router.post('/:callId/end', endCall);
router.post('/:callId/reject', rejectCall);

// Call history and details
router.get('/history', getCallHistory);
router.get('/:callId', getCallDetails);

module.exports = router;