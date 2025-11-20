// src/validators/postValidator.js
const { body } = require('express-validator');

exports.createPostValidation = [
  body('text')
    .optional()
    .trim(),
  body('postType')
    .optional()
    .isIn(['text', 'poll', 'image', 'video'])
    .withMessage('Invalid post type'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'friends'])
    .default('public'),
  body('poll.question')
    .if(body('postType').equals('poll'))
    .notEmpty()
    .withMessage('Poll question is required'),
  body('poll.options')
    .if(body('postType').equals('poll'))
    .isArray({ min: 2, max: 6 })
    .withMessage('Poll must have 2-6 options'),
  body('poll.options.*')
    .trim()
    .notEmpty()
    .withMessage('Poll option cannot be empty')
];