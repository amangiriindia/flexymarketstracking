// src/controllers/userController.js
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');
const { formatLoginInfo } = require('../services/ipAuthService');
const { uploadMedia } = require('../services/cloudinaryService');
const LoginHistory = require('../models/LoginHistory');

/**
 * 
 * @desc    Get logged-in user's full private profile
 */
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile fetched successfully',
      data: {
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          followersCount: user.followersCount || 0,
          followingCount: user.followingCount || 0,
          registeredFrom: user.registeredIp
            ? formatLoginInfo(user.registeredIp, user.registeredDevice || 'Unknown Device')
            : 'Unknown',
          lastLoginAt: user.lastLoginAt || null,
          lastLoginFrom: user.lastIp
            ? formatLoginInfo(user.lastIp, user.lastDevice || 'Unknown Device')
            : 'Never logged in'
        }
      }
    });
  } catch (error) {
    console.error('Get My Profile Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Update logged-in user's profile (with avatar upload)
 */
exports.updateMyProfile = async (req, res) => {
  try {
    const updates = {};

    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.phone) updates.phone = req.body.phone;

    if (req.file) {
      try {
        const result = await uploadMedia([req.file]);
        updates.avatar = result[0].url;
      } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Avatar upload failed' });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ status: 'error', message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully!',
      data: { user }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile' });
  }
};

/**
 * @desc    Get complete stats of logged-in user
 */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      totalPosts,
      livePosts,
      inReviewPosts,
      rejectedPosts,
      likesGiven,
      commentsMade,
      totalShares,
      followers,
      following,
      likesReceived
    ] = await Promise.all([
      Post.countDocuments({ user: userId, isActive: true }),
      Post.countDocuments({ user: userId, status: 'live', isActive: true }),
      Post.countDocuments({ user: userId, status: 'inReview', isActive: true }),
      Post.countDocuments({ user: userId, status: 'rejected', isActive: true }),

      Post.countDocuments({ 'likes.user': userId }),
      Comment.countDocuments({ user: userId, isActive: true }),

      Post.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId), status: 'live', isActive: true } },
        { $group: { _id: null, total: { $sum: '$sharesCount' } } }
      ]).then(r => r[0]?.total || 0),

      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower: userId }),

      Post.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
        { $unwind: '$likes' },
        { $count: 'total' }
      ]).then(r => r[0]?.total || 0)
    ]);

    res.status(200).json({
      status: 'success',
      message: 'User stats fetched',
      data: {
        stats: {
          posts: { total: totalPosts, live: livePosts, inReview: inReviewPosts, rejected: rejectedPosts },
          engagement: { likesGiven, likesReceived, commentsMade, totalShares },
          social: { followers, following },
          engagementScore: likesReceived + commentsMade + totalShares
        },
        summary: {
          approvalRate: totalPosts > 0 ? Math.round((livePosts / totalPosts) * 100) : 0,
          visibilityRate: (livePosts + inReviewPosts) > 0
            ? Math.round((livePosts / (livePosts + inReviewPosts)) * 100)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get User Stats Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Get all posts of logged-in user
 */
exports.getMyPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ user: req.user.id, isActive: true })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Post.countDocuments({ user: req.user.id, isActive: true })
    ]);

    const postsWithStatus = posts.map(post => ({
      ...post,
      canEdit: ['inReview', 'rejected'].includes(post.status),
      statusLabel: post.status === 'inReview' ? 'Under Review' :
                   post.status === 'live' ? 'Live' : 'Rejected'
    }));

    res.status(200).json({
      status: 'success',
      data: {
        posts: postsWithStatus,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get My Posts Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Get public profile of any user
 */
exports.getUserPublicProfile = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId)
      .select('name avatar role createdAt followersCount followingCount');

    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const [totalPosts, livePosts] = await Promise.all([
      Post.countDocuments({ user: req.params.userId, isActive: true }),
      Post.countDocuments({ user: req.params.userId, status: 'live', isActive: true })
    ]);

    const isFollowing = await Follow.findOne({
      follower: req.user.id,
      following: req.params.userId
    });

    res.status(200).json({
      status: 'success',
      data: {
        profile: {
          id: targetUser._id,
          name: targetUser.name,
          avatar: targetUser.avatar,
          role: targetUser.role,
          createdAt: targetUser.createdAt,
          followersCount: targetUser.followersCount || 0,
          followingCount: targetUser.followingCount || 0,
          totalPosts,
          livePosts,
          isFollowing: !!isFollowing,
          canFollow: req.user.id !== req.params.userId
        }
      }
    });
  } catch (error) {
    console.error('Get Public Profile Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Get followers list (my or someone else's)
 */
exports.getUserFollowers = async (req, res) => {
  try {
    const targetId = req.params.userId || req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      Follow.find({ following: targetId })
        .populate('follower', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Follow.countDocuments({ following: targetId })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        followers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get Followers Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Get following list (my or someone else's)
 */
// src/controllers/userController.js → Replace getUserFollowing
exports.getUserFollowing = async (req, res) => {
  try {
    const targetId = req.params.userId || req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [followingList, total] = await Promise.all([
      Follow.find({ follower: targetId })
        .populate({
          path: 'following',
          select: 'name avatar',
          match: { isActive: true } // Only active users
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Follow.countDocuments({ follower: targetId })
    ]);

    // Filter out deleted/blocked users & format safely
    const formattedList = followingList
      .filter(f => f.following !== null) // Remove nulls
      .map(f => ({
        _id: f._id,
        following: {
          _id: f.following._id,
          name: f.following.name,
          avatar: f.following.avatar || 'https://via.placeholder.com/150'
        },
        status: f.status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      }));

    res.status(200).json({
      status: 'success',
      data: {
        following: formattedList,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get Following List Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Check if I follow a user
 */
exports.getFollowStatus = async (req, res) => {
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
    console.error('Follow Status Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Get complete login + registration history of the user
 * @route   GET /api/v1/users/login-history
 * @access  Private (only own history)
 */
exports.getLoginHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      LoginHistory.find({ user: req.user.id })
        .sort({ loginAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      LoginHistory.countDocuments({ user: req.user.id })
    ]);

    const formattedHistory = history.map(entry => ({
      id: entry._id,
      ip: entry.ip,
      device: entry.device,
      userAgent: entry.userAgent,
      loginAt: entry.loginAt,
      location: entry.location ? {
        country: entry.location.country || 'Unknown',
        state: entry.location.state || 'Unknown',
        city: entry.location.city || 'Unknown',
        pincode: entry.location.pincode || 'Unknown',
        formattedAddress: entry.location.formattedAddress || 'Unknown',
        lat: entry.location.lat || null,
        lng: entry.location.lng || null
      } : null
    }));

    res.status(200).json({
      status: 'success',
      message: 'Login history fetched',
      data: {
        history: formattedHistory,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + history.length < total
        }
      }
    });
  } catch (error) {
    console.error('Get Login History Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};