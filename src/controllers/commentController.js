// src/controllers/commentController.js
const Comment = require('../models/Comment');
const Post = require('../models/Post');

// @desc    Create a new comment or reply
// @route   POST /api/v1/comments
// @access  Private
exports.createComment = async (req, res, next) => {
  try {
    const { postId, text, parentCommentId } = req.body;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found or has been deleted'
      });
    }

    // Validate parent comment if it's a reply
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment || !parentComment.isActive || parentComment.post.toString() !== postId) {
        return res.status(404).json({
          status: 'error',
          message: 'Parent comment not found or invalid'
        });
      }
    }

    const comment = await Comment.create({
      post: postId,
      user: req.user.id,
      text: text.trim(),
      parentComment: parentCommentId || null
    });

    await comment.populate('user', 'name avatar email');

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully',
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top-level comments for a post
// @route   GET /api/v1/comments/post/:postId
// @access  Public
exports.getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ post: postId, parentComment: null, isActive: true })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Comment.countDocuments({ post: postId, parentComment: null, isActive: true })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        comments,
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

// @desc    Get replies to a specific comment
// @route   GET /api/v1/comments/:commentId/replies
// @access  Public
exports.getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      Comment.find({ parentComment: commentId, isActive: true })
        .populate('user', 'name avatar email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Comment.countDocuments({ parentComment: commentId, isActive: true })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        replies,
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

// @desc    Update comment text
// @route   PUT /api/v1/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment text cannot be empty'
      });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment || !comment.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Ownership check
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to edit this comment'
      });
    }

    comment.text = text.trim();
    comment.isEdited = true;
    await comment.save();

    await comment.populate('user', 'name avatar email');

    res.status(200).json({
      status: 'success',
      message: 'Comment updated successfully',
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete (soft or hard) comment
// @route   DELETE /api/v1/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Ownership check
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this comment'
      });
    }

    // Soft delete (recommended)
    comment.isActive = false;
    comment.text = '[This comment was deleted]';
    await comment.save();

    // Or use: await Comment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like or unlike a comment
// @route   POST /api/v1/comments/:id/like
// @access  Private
exports.likeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment || !comment.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    const userIdStr = req.user.id.toString();
    const likedIndex = comment.likes.findIndex(l => l.user.toString() === userIdStr);

    if (likedIndex > -1) {
      comment.likes.splice(likedIndex, 1);
      await comment.save();
      return res.status(200).json({
        status: 'success',
        message: 'Comment unliked',
        data: { likesCount: comment.likes.length, liked: false }
      });
    }

    comment.likes.push({ user: req.user.id });
    await comment.save();

    res.status(200).json({
      status: 'success',
      message: 'Comment liked',
      data: { likesCount: comment.likes.length, liked: true }
    });
  } catch (error) {
    next(error);
  }
};