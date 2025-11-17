// src/controllers/commentController.js
const Comment = require('../models/Comment');
const Post = require('../models/Post');

// @desc    Create a comment
// @route   POST /api/v1/comments
// @access  Private
exports.createComment = async (req, res, next) => {
  try {
    const { postId, text, parentCommentId } = req.body;

    // Validate post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // If it's a reply, validate parent comment exists
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          status: 'error',
          message: 'Parent comment not found'
        });
      }
    }

    const comment = await Comment.create({
      post: postId,
      user: req.user.id,
      text,
      parentComment: parentCommentId || null
    });

    await comment.populate('user', 'name email avatar');

    res.status(201).json({
      status: 'success',
      message: 'Comment created successfully',
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comments for a post
// @route   GET /api/v1/comments/post/:postId
// @access  Public
exports.getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get top-level comments (no parent)
    const comments = await Comment.find({ 
      post: postId, 
      parentComment: null,
      isActive: true 
    })
      .populate('user', 'name email avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ 
      post: postId, 
      parentComment: null,
      isActive: true 
    });

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

// @desc    Get replies for a comment
// @route   GET /api/v1/comments/:commentId/replies
// @access  Public
exports.getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const replies = await Comment.find({ 
      parentComment: commentId,
      isActive: true 
    })
      .populate('user', 'name email avatar')
      .sort('createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ 
      parentComment: commentId,
      isActive: true 
    });

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

// @desc    Update a comment
// @route   PUT /api/v1/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check ownership
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this comment'
      });
    }

    const { text } = req.body;
    
    comment.text = text;
    comment.isEdited = true;
    await comment.save();

    await comment.populate('user', 'name email avatar');

    res.status(200).json({
      status: 'success',
      message: 'Comment updated successfully',
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a comment
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

    // Check ownership
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this comment'
      });
    }

    await comment.remove();

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/Unlike a comment
// @route   POST /api/v1/comments/:id/like
// @access  Private
exports.likeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check if already liked
    const likeIndex = comment.likes.findIndex(
      like => like.user.toString() === req.user.id
    );

    if (likeIndex > -1) {
      // Unlike
      comment.likes.splice(likeIndex, 1);
    } else {
      // Like
      comment.likes.push({ user: req.user.id });
    }

    await comment.save();

    res.status(200).json({
      status: 'success',
      message: likeIndex > -1 ? 'Comment unliked' : 'Comment liked',
      data: { likesCount: comment.likes.length }
    });
  } catch (error) {
    next(error);
  }
};