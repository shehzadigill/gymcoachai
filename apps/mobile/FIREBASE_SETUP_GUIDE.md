# 🔥 Firebase Setup Guide for GymCoach AI Mobile App

## 📋 **What You Need to Create:**

Your mobile app needs Firebase for push notifications. Here's exactly what to create and configure:

## 🚀 **Step 1: Create Firebase Project**

1. **Go to Firebase Console:** https://console.firebase.google.com/
2. **Click "Add project"**
3. **Project name:** `gymcoach-ai` (or your preferred name)
4. **Enable Google Analytics:** Yes (recommended)
5. **Create project**

## 📱 **Step 2: Add iOS App**

1. **In Firebase Console → Project Overview → Add app → iOS**
2. **iOS bundle ID:** `com.gymcoach.mobile` (matches your app.json)
3. **App nickname:** `GymCoach AI iOS`
4. **App Store ID:** Leave blank for now
5. **Register app**
6. **Download `GoogleService-Info.plist`**
7. **IMPORTANT:** Move this file to `/ios/mobile/GoogleService-Info.plist`

## 🤖 **Step 3: Add Android App**

1. **In Firebase Console → Add app → Android**
2. **Android package name:** `com.gymcoach.mobile`
3. **App nickname:** `GymCoach AI Android`
4. **Debug signing certificate SHA-1:** (Optional for development)
5. **Register app**
6. **Download `google-services.json`**
7. **IMPORTANT:** Move this file to `/android/app/google-services.json`

## 🔔 **Step 4: Enable Cloud Messaging**

1. **In Firebase Console → Project Settings → Cloud Messaging tab**
2. **Note down these values:**
   - **Project ID:** (e.g., `gymcoach-ai-12345`)
   - **Sender ID:** (e.g., `123456789012`)
   - **Server Key:** (starts with `AAAA...`)
   - **VAPID Key:** (for web push - optional for mobile)

## 🔑 **Step 5: Get Firebase App Configuration**

### **For iOS:**

In `GoogleService-Info.plist`, find:

```xml
<key>GOOGLE_APP_ID</key>
<string>1:123456789012:ios:abcd1234efgh5678</string>
```

### **For Android:**

In `google-services.json`, find:

```json
{
  "project_info": {
    "project_id": "gymcoach-ai-12345"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:123456789012:android:abcd1234efgh5678"
      }
    }
  ]
}
```

## 📝 **Step 6: Update Your .env File**

Replace the Firebase section in `/apps/mobile/.env`:

```env
# Firebase Configuration (for push notifications)
FIREBASE_PROJECT_ID=gymcoach-ai-12345
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_SERVER_KEY=AAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIREBASE_APP_ID=1:123456789012:ios:abcd1234efgh5678
FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔧 **Step 7: Configure iOS Project**

1. **Open Xcode:** `open ios/mobile.xcworkspace`
2. **Drag `GoogleService-Info.plist` into Xcode project**
3. **Make sure it's added to the target `GymCoachMobile`**
4. **Build Settings → Swift Compiler - Custom Flags → OTHER_SWIFT_FLAGS**
5. **Add:** `-DFIREBASE_ANALYTICS_SUPPRESS_WARNING`

## 🔧 **Step 8: Configure Android Project**

1. **Ensure `google-services.json` is in `/android/app/`**
2. **Check `/android/build.gradle` has:**
   ```gradle
   dependencies {
       classpath 'com.google.gms:google-services:4.3.15'
   }
   ```
3. **Check `/android/app/build.gradle` has:**
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

## 🎯 **Step 9: Test Firebase Integration**

Run your app and check:

```bash
# iOS
npm run ios

# Android
npm run android
```

Look for Firebase initialization logs:

- iOS: `Firebase configured successfully`
- Android: `Firebase app initialized`

## 🔔 **Step 10: Push Notification Backend Implementation**

You mentioned implementing push notifications in the nutrition service. Here's what you need:

### **Nutrition Service Lambda Function Updates:**

1. **Install Firebase Admin SDK:**

   ```bash
   cd services/nutrition-service
   npm install firebase-admin
   ```

2. **Add Firebase Service Account:**

   - Firebase Console → Project Settings → Service Accounts
   - Generate new private key (JSON file)
   - Store securely in AWS Secrets Manager or as environment variable

3. **Implement Push Notification Function:**

   ```javascript
   // In nutrition-service/src/notifications.js
   const admin = require('firebase-admin');

   // Initialize Firebase Admin
   admin.initializeApp({
     credential: admin.credential.cert({
       projectId: process.env.FIREBASE_PROJECT_ID,
       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
     }),
   });

   async function sendNutritionReminder(userToken, message) {
     const payload = {
       notification: {
         title: '🍎 Nutrition Reminder',
         body: message,
         icon: 'https://your-app-icon-url.com/icon.png',
       },
       data: {
         type: 'nutrition_reminder',
         timestamp: Date.now().toString(),
       },
     };

     return admin.messaging().sendToDevice(userToken, payload);
   }
   ```

## 📊 **Expected Firebase Configuration:**

After setup, your Firebase project should have:

- ✅ **iOS App** (com.gymcoach.mobile)
- ✅ **Android App** (com.gymcoach.mobile)
- ✅ **Cloud Messaging enabled**
- ✅ **Service account for server-side integration**
- ✅ **Push notification certificates/keys**

## 🚨 **Important Security Notes:**

1. **Never commit Firebase config files to git**
2. **Use environment variables for sensitive keys**
3. **Rotate server keys regularly**
4. **Restrict API key usage in Firebase Console**

## 🎉 **Next Steps After Firebase Setup:**

1. **Update your .env file with real Firebase values**
2. **Test push notifications in development**
3. **Implement nutrition reminders in backend**
4. **Test on real devices (simulators have limitations)**

---

## 📞 **Need Help?**

If you encounter issues:

1. Check Firebase Console logs
2. Verify all config files are in correct locations
3. Ensure bundle IDs match exactly
4. Test with physical devices (not just simulators)

**Once you have your Firebase keys, update the .env file and let me know - I'll help implement the push notification backend in your nutrition service!** 🚀
