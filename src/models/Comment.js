// src/models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Comment text is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  repliesCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ parentComment: 1 });

// Update comments count on post
commentSchema.post('save', async function() {
  if (!this.parentComment) {
    await mongoose.model('Post').findByIdAndUpdate(this.post, {
      $inc: { commentsCount: 1 }
    });
  } else {
    await mongoose.model('Comment').findByIdAndUpdate(this.parentComment, {
      $inc: { repliesCount: 1 }
    });
  }
});

// Decrease comments count on deletion
commentSchema.post('remove', async function() {
  if (!this.parentComment) {
    await mongoose.model('Post').findByIdAndUpdate(this.post, {
      $inc: { commentsCount: -1 }
    });
  } else {
    await mongoose.model('Comment').findByIdAndUpdate(this.parentComment, {
      $inc: { repliesCount: -1 }
    });
  }
});

module.exports = mongoose.model('Comment', commentSchema);