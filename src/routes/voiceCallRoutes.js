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

router.use(protect);

router.post('/initiate', authorize('admin'), initiateCall);
router.post('/user-call', userToUserCall);
router.post('/:callId/answer', answerCall);
router.post('/:callId/end', endCall);
router.post('/:callId/reject', rejectCall);
router.get('/history', getCallHistory);
router.get('/:callId', getCallDetails);

module.exports = router;