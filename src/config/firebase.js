// src/config/firebase.js

const admin = require('firebase-admin');
const serviceAccount = require('./flexy-66d49-firebase-adminsdk-fbsvc-3660285967.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
