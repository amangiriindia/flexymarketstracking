// src/controllers/postController.js
const Post = require('../models/Post');
const cloudinary = require('../config/cloudinary');

// @desc    Create a post
// @route   POST /api/v1/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    const { text, postType, poll, visibility } = req.body;
    
    const postData = {
      user: req.user.id,
      postType: postType || 'text',
      visibility: visibility || 'public'
    };

    // Handle text content
    if (text) {
      postData.content = { text };
    }

    // Handle poll
    if (postType === 'poll' && poll) {
      postData.poll = {
        question: poll.question,
        options: poll.options.map(opt => ({ text: opt, votes: [] })),
        endsAt: poll.endsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowMultipleVotes: poll.allowMultipleVotes || false
      };
    }

    // Handle media files
    if (req.files && req.files.length > 0) {
      const mediaArray = [];
      
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'posts',
          resource_type: 'auto'
        });

        mediaArray.push({
          type: file.mimetype.startsWith('image') ? 'image' : 'video',
          url: result.secure_url,
          publicId: result.public_id,
          thumbnail: result.thumbnail_url || result.secure_url
        });
      }

      postData.media = mediaArray;
    }

    const post = await Post.create(postData);
    await post.populate('user', 'name email avatar');

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all posts (feed)
// @route   GET /api/v1/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isActive: true, visibility: 'public' })
      .populate('user', 'name email avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ isActive: true, visibility: 'public' });

    res.status(200).json({
      status: 'success',
      data: {
        posts,
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

// @desc    Get single post
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate('likes.user', 'name avatar');

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post
// @route   PUT /api/v1/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check ownership
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this post'
      });
    }

    const { text, visibility } = req.body;
    
    if (text) post.content.text = text;
    if (visibility) post.visibility = visibility;

    await post.save();
    await post.populate('user', 'name email avatar');

    res.status(200).json({
      status: 'success',
      message: 'Post updated successfully',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/v1/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check ownership
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this post'
      });
    }

    // Delete media from cloudinary
    if (post.media && post.media.length > 0) {
      for (const media of post.media) {
        await cloudinary.uploader.destroy(media.publicId);
      }
    }

    await post.remove();

    res.status(200).json({
      status: 'success',
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/Unlike a post
// @route   POST /api/v1/posts/:id/like
// @access  Private
exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Check if already liked
    const likeIndex = post.likes.findIndex(
      like => like.user.toString() === req.user.id
    );

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push({ user: req.user.id });
    }

    await post.save();

    res.status(200).json({
      status: 'success',
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      data: { likesCount: post.likes.length }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on a poll
// @route   POST /api/v1/posts/:id/vote
// @access  Private
exports.voteOnPoll = async (req, res, next) => {
  try {
    const { optionIndex } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post || post.postType !== 'poll') {
      return res.status(404).json({
        status: 'error',
        message: 'Poll not found'
      });
    }

    // Check if poll has ended
    if (new Date() > post.poll.endsAt) {
      return res.status(400).json({
        status: 'error',
        message: 'Poll has ended'
      });
    }

    // Check if user has already voted
    const hasVoted = post.poll.options.some(option =>
      option.votes.some(vote => vote.user.toString() === req.user.id)
    );

    if (hasVoted && !post.poll.allowMultipleVotes) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already voted on this poll'
      });
    }

    // Add vote
    post.poll.options[optionIndex].votes.push({ user: req.user.id });
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Vote recorded successfully',
      data: { poll: post.poll }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's posts
// @route   GET /api/v1/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      user: req.params.userId, 
      isActive: true 
    })
      .populate('user', 'name email avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ 
      user: req.params.userId, 
      isActive: true 
    });

    res.status(200).json({
      status: 'success',
      data: {
        posts,
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