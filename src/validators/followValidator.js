// src/validators/followValidator.js
const { param } = require('express-validator');

exports.userIdParam = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
];