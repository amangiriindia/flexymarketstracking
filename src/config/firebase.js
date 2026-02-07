// src/config/firebase.js

const admin = require('firebase-admin');
const serviceAccount = require('./flexy-66d49-firebase-adminsdk-fbsvc-843e6f818e.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
