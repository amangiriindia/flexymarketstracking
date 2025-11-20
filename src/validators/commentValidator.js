// src/validators/commentValidator.js
const { body, param } = require('express-validator');

exports.createCommentValidation = [
  body('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required'),
  body('parentCommentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent comment ID')
];

exports.commentIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid comment ID'),
  param('commentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid comment ID')
];