// src/controllers/followController.js
const Follow = require('../models/Follow');
const User = require('../models/User');

// @desc    Follow a user
// @route   POST /api/v1/follow/:userId
// @access  Private
exports.followUser = async (req, res, next) => {
  try {
    const userToFollow = req.params.userId;

    if (userToFollow === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'You cannot follow yourself' });
    }

    const existingFollow = await Follow.findOne({
      follower: req.user.id,
      following: userToFollow
    });

    if (existingFollow) {
      return res.status(400).json({ status: 'error', message: 'Already following' });
    }

    await Follow.create({
      follower: req.user.id,
      following: userToFollow
    });

    res.status(200).json({
      status: 'success',
      message: 'User followed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/v1/follow/:userId
// @access  Private
exports.unfollowUser = async (req, res, next) => {
  try {
    await Follow.deleteOne({
      follower: req.user.id,
      following: req.params.userId
    });

    res.status(200).json({
      status: 'success',
      message: 'User unfollowed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get followers list
// @route   GET /api/v1/follow/followers/:userId?
// @access  Public
exports.getFollowers = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const followers = await Follow.find({ following: userId })
      .populate('follower', 'name avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Follow.countDocuments({ following: userId });

    res.status(200).json({
      status: 'success',
      data: {
        followers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get following list
// @route   GET /api/v1/follow/following/:userId?
// @access  Public
exports.getFollowing = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const following = await Follow.find({ follower: userId })
      .populate('following', 'name avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Follow.countDocuments({ follower: userId });

    res.status(200).json({
      status: 'success',
      data: {
        following,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if current user follows target user
// @route   GET /api/v1/follow/status/:userId
// @access  Private
exports.getFollowStatus = async (req, res, next) => {
  try {
    const follow = await Follow.findOne({
      follower: req.user.id,
      following: req.params.userId
    });

    res.status(200).json({
      status: 'success',
      data: { isFollowing: !!follow }
    });
  } catch (error) {
    next(error);
  }
};