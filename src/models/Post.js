// src/models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      trim: true,
      maxlength: [5000, 'Post text cannot exceed 5000 characters']
    }
  },
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'poll', 'mixed'],
    default: 'text'
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video']
    },
    url: String,
    publicId: String,
    thumbnail: String
  }],
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }]
    }],
    endsAt: Date,
    allowMultipleVotes: {
      type: Boolean,
      default: false
    }
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
  commentsCount: {
    type: Number,
    default: 0
  },
  sharesCount: {
    type: Number,
    default: 0
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'followers'],
    default: 'public'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ 'likes.user': 1 });

// Virtual for likes count
postSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

// Ensure virtuals are included when converting to JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);