const admin = require('firebase-admin');

// Initialize Firebase Admin
// NOTE: Update path to your service account key
const serviceAccount = require('./path/to/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[FCM] ✅ Firebase Admin initialized');
}

// Get token from command line or use default
const token = process.argv[2] || 'YOUR_TOKEN_HERE';
const title = process.argv[3] || 'Test Notification';
const body = process.argv[4] || 'Testing FCM directly';

console.log('[FCM] Sending test notification...');
console.log('[FCM] Token:', token.substring(0, 20) + '...');

const message = {
  token: token,
  notification: {
    title: title,
    body: body,
    sound: 'default'
  },
  data: {
    Title: title,
    Body: body,
    type: 'test',
    link: '/notifications'
  },
  priority: 'high',
  android: {
    priority: 'high',
    notification: {
      channelId: 'default',
      sound: 'default',
      priority: 'high'
    }
  }
};

admin.messaging().send(message)
  .then((response) => {
    console.log('✅ Successfully sent message:', response);
    console.log('✅ Notification should appear on device now!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error sending message:', error.code, error.message);
    if (error.code === 'messaging/invalid-registration-token') {
      console.error('   Token is invalid or expired');
    } else if (error.code === 'messaging/registration-token-not-registered') {
      console.error('   Token is not registered');
    }
    process.exit(1);
  });
