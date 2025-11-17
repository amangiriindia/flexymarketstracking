// src/controllers/voiceCallController.js
const VoiceCall = require('../models/VoiceCall');
const User = require('../models/User');
const agoraService = require('../services/agoraService');
const { v4: uuidv4 } = require('uuid');

// @desc    Initiate a voice call (Admin to User)
// @route   POST /api/v1/voice-calls/initiate
// @access  Private (Admin only)
exports.initiateCall = async (req, res, next) => {
  try {
    const { receiverId, receiverPhone } = req.body;

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        status: 'error',
        message: 'Receiver not found'
      });
    }

    // Generate unique call ID and channel name
    const callId = uuidv4();
    const channelName = `call_${callId}`;

    // Generate Agora token for caller (admin)
    const callerToken = agoraService.generateRtcToken(
      channelName,
      req.user.agoraUid || 0
    );

    // Generate Agora token for receiver
    const receiverToken = agoraService.generateRtcToken(
      channelName,
      receiver.agoraUid
    );

    // Create call record
    const call = await VoiceCall.create({
      callId,
      channelName,
      caller: req.user.id,
      receiver: receiverId,
      callerPhone: req.user.phone,
      receiverPhone: receiverPhone || receiver.phone,
      callType: 'admin_to_user',
      status: 'initiated',
      agoraToken: callerToken
    });

    // TODO: Send push notification to receiver with call details
    // notificationService.sendCallNotification(receiver, call, receiverToken);

    res.status(200).json({
      status: 'success',
      message: 'Call initiated successfully',
      data: {
        call: {
          callId: call.callId,
          channelName: call.channelName,
          receiverId: receiver._id,
          receiverName: receiver.name,
          receiverPhone: receiver.phone
        },
        callerToken,
        receiverToken, // Send this to receiver via push notification
        agoraAppId: process.env.AGORA_APP_ID
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    User to User call initiation
// @route   POST /api/v1/voice-calls/user-call
// @access  Private
exports.userToUserCall = async (req, res, next) => {
  try {
    const { receiverId } = req.body;

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        status: 'error',
        message: 'Receiver not found'
      });
    }

    // Check if calling self
    if (receiverId === req.user.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot call yourself'
      });
    }

    // Generate unique call ID and channel name
    const callId = uuidv4();
    const channelName = `call_${callId}`;

    // Generate Agora tokens
    const callerToken = agoraService.generateRtcToken(
      channelName,
      req.user.agoraUid
    );

    const receiverToken = agoraService.generateRtcToken(
      channelName,
      receiver.agoraUid
    );

    // Create call record
    const call = await VoiceCall.create({
      callId,
      channelName,
      caller: req.user.id,
      receiver: receiverId,
      callerPhone: req.user.phone,
      receiverPhone: receiver.phone,
      callType: 'user_to_user',
      status: 'ringing',
      agoraToken: callerToken
    });

    // TODO: Send push notification to receiver
    // notificationService.sendCallNotification(receiver, call, receiverToken);

    res.status(200).json({
      status: 'success',
      message: 'Call initiated successfully',
      data: {
        call: {
          callId: call.callId,
          channelName: call.channelName,
          receiver: {
            id: receiver._id,
            name: receiver.name,
            avatar: receiver.avatar
          }
        },
        token: callerToken,
        agoraAppId: process.env.AGORA_APP_ID
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Answer a call
// @route   POST /api/v1/voice-calls/:callId/answer
// @access  Private
exports.answerCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    const call = await VoiceCall.findOne({ callId });
    if (!call) {
      return res.status(404).json({
        status: 'error',
        message: 'Call not found'
      });
    }

    // Verify the user is the receiver
    if (call.receiver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to answer this call'
      });
    }

    // Update call status
    call.status = 'answered';
    call.startTime = new Date();
    await call.save();

    // Generate token for receiver
    const token = agoraService.generateRtcToken(
      call.channelName,
      req.user.agoraUid
    );

    res.status(200).json({
      status: 'success',
      message: 'Call answered',
      data: {
        channelName: call.channelName,
        token,
        agoraAppId: process.env.AGORA_APP_ID
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    End a call
// @route   POST /api/v1/voice-calls/:callId/end
// @access  Private
exports.endCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    const call = await VoiceCall.findOne({ callId });
    if (!call) {
      return res.status(404).json({
        status: 'error',
        message: 'Call not found'
      });
    }

    // Verify user is part of the call
    if (call.caller.toString() !== req.user.id && 
        call.receiver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to end this call'
      });
    }

    // Update call status
    call.status = 'ended';
    call.endTime = new Date();
    
    // Calculate duration
    if (call.startTime) {
      call.duration = Math.floor((call.endTime - call.startTime) / 1000);
    }
    
    await call.save();

    res.status(200).json({
      status: 'success',
      message: 'Call ended',
      data: {
        duration: call.duration
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a call
// @route   POST /api/v1/voice-calls/:callId/reject
// @access  Private
exports.rejectCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    const call = await VoiceCall.findOne({ callId });
    if (!call) {
      return res.status(404).json({
        status: 'error',
        message: 'Call not found'
      });
    }

    // Verify the user is the receiver
    if (call.receiver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to reject this call'
      });
    }

    call.status = 'rejected';
    call.endTime = new Date();
    await call.save();

    res.status(200).json({
      status: 'success',
      message: 'Call rejected'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call history
// @route   GET /api/v1/voice-calls/history
// @access  Private
exports.getCallHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const calls = await VoiceCall.find({
      $or: [
        { caller: req.user.id },
        { receiver: req.user.id }
      ]
    })
      .populate('caller', 'name avatar phone')
      .populate('receiver', 'name avatar phone')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await VoiceCall.countDocuments({
      $or: [
        { caller: req.user.id },
        { receiver: req.user.id }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: {
        calls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single call details
// @route   GET /api/v1/voice-calls/:callId
// @access  Private
exports.getCallDetails = async (req, res, next) => {
  try {
    const call = await VoiceCall.findOne({ callId: req.params.callId })
      .populate('caller', 'name avatar phone')
      .populate('receiver', 'name avatar phone');

    if (!call) {
      return res.status(404).json({
        status: 'error',
        message: 'Call not found'
      });
    }

    // Verify user is part of the call or is admin
    if (call.caller._id.toString() !== req.user.id && 
        call.receiver._id.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this call'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { call }
    });
  } catch (error) {
    next(error);
  }
};