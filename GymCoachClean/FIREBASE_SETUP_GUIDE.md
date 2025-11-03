# Firebase Push Notifications Setup Guide

## Error Fixed

**Error**: `No Firebase App '[DEFAULT]' has been created - call firebase.initializeApp()`

**Root Cause**: Mixed web Firebase SDK (`firebase/app`) with React Native Firebase (`@react-native-firebase/app`)

**Solution**: Updated to use React Native Firebase native initialization instead of JavaScript initialization.

## ✅ Changes Made

### 1. Updated `src/services/firebase.ts`

- Removed web Firebase SDK imports
- Now uses React Native Firebase (configured via native files)
- Added initialization check function

### 2. Updated `android/build.gradle`

- Added Google Services plugin dependency: `com.google.gms:google-services:4.4.0`

### 3. Updated `android/app/build.gradle`

- Applied Google Services plugin at the bottom of the file

### 4. Updated `src/App.tsx`

- Made notification initialization non-blocking
- Only initializes when user is authenticated
- App continues to work even if Firebase is not configured

## 📦 Current Setup Status

### ✅ Already Configured

- [x] React Native Firebase packages installed
- [x] `google-services.json` exists at `android/app/google-services.json`
- [x] `GoogleService-Info.plist` exists at `ios/GymCoachClean/GoogleService-Info.plist`
- [x] Google Services plugin added to build.gradle

### ⚠️ Requires Rebuild

Since we modified native Android configuration, you need to rebuild the app:

```bash
cd /Users/babar/projects/gymcoach-ai/GymCoachClean

# Clean previous builds
rm -rf android/build android/app/build

# Rebuild Android app
npx react-native run-android

# OR for iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

## 🔍 Verification Steps

After rebuilding, check the logs:

1. **Firebase Initialization**: Should see `✅ Firebase initialized successfully`
2. **No Error**: The error `No Firebase App '[DEFAULT]' has been created` should be gone
3. **Token Registration**: Should see device token logged

### Expected Log Output

```
✅ Firebase initialized successfully
Initializing notification service...
Device token registered successfully: ABCD...
Notifications initialized successfully
```

## 📱 Testing Push Notifications

### 1. Get Device Token

After running the app, check logs for:

```
Device token registered successfully: ABCD1234...
```

### 2. Test via Firebase Console

1. Go to Firebase Console → Your Project
2. Navigate to **Cloud Messaging**
3. Click **Send your first message**
4. Enter a notification title and body
5. Click **Send test message**
6. Paste your device token
7. Click **Test**

### 3. Test via Backend API

```bash
curl -X POST https://d202qmtk8kkxra.cloudfront.net/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "notification_type": "workout_reminder",
    "title": "Time to workout!",
    "body": "Your scheduled workout is starting soon"
  }'
```

## 🔧 Configuration Files

### Android: `google-services.json`

Location: `android/app/google-services.json`

**Contents** (if you need to recreate):

```json
{
  "project_info": {
    "project_number": "460820256285",
    "project_id": "gymcoach-73528",
    "storage_bucket": "gymcoach-73528.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:460820256285:android:31bdfa9a9d1ab2a43b98f4",
        "android_client_info": {
          "package_name": "com.gymcoachclean"
        }
      },
      "oauth_client": [],
      "api_key": [
        {
          "current_key": "AIzaSyDGesfEwwAcnE8A19dX13YYCXooMNmx7E8"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
}
```

### iOS: `GoogleService-Info.plist`

Location: `ios/GymCoachClean/GoogleService-Info.plist`

Make sure it's added to your Xcode project:

1. Open `ios/GymCoachClean.xcworkspace` in Xcode
2. Verify `GoogleService-Info.plist` is in the project navigator
3. Check it's included in the app target

## 🐛 Troubleshooting

### Error: "Default FirebaseApp is not initialized"

**Solution**:

1. Check `google-services.json` exists in `android/app/`
2. Verify Google Services plugin is applied in `build.gradle`
3. Clean and rebuild: `cd android && ./gradlew clean && cd ..`

### Error: "FirebaseApp name [DEFAULT] already exists"

**Solution**: This is expected in debug mode with hot reload. Restart the app.

### No Device Token Received

**Solution**:

1. Check notification permissions are granted
2. Verify internet connectivity
3. Check Firebase console for any project issues
4. Try uninstalling and reinstalling the app

### iOS Build Fails

**Solution**:

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Notifications Not Appearing

**Solution**:

1. Check notification permissions in device settings
2. Verify device token is registered in backend
3. Check Firebase Cloud Messaging quota
4. Ensure app is in background (foreground notifications need custom handling)

## 📚 Additional Setup (Optional)

### Android Notification Icons

Add custom notification icons:

```
android/app/src/main/res/
  ├── drawable-mdpi/ic_notification.png
  ├── drawable-hdpi/ic_notification.png
  ├── drawable-xhdpi/ic_notification.png
  ├── drawable-xxhdpi/ic_notification.png
  └── drawable-xxxhdpi/ic_notification.png
```

Update `AndroidManifest.xml`:

```xml
<meta-data
  android:name="com.google.firebase.messaging.default_notification_icon"
  android:resource="@drawable/ic_notification" />
<meta-data
  android:name="com.google.firebase.messaging.default_notification_color"
  android:resource="@color/notification_color" />
```

### iOS Notification Capabilities

1. Open Xcode project
2. Select your target
3. Go to **Signing & Capabilities**
4. Add **Push Notifications** capability
5. Add **Background Modes** → Enable **Remote notifications**

## 🔐 Security Notes

- Device tokens are sensitive - handle securely
- Never commit `google-services.json` or `GoogleService-Info.plist` to public repos (already in .gitignore)
- Firebase API keys in these files are safe for mobile apps (domain-restricted)
- Backend validates all notification requests with user authentication

## 📖 References

- [React Native Firebase Docs](https://rnfirebase.io/)
- [FCM Setup Guide](https://firebase.google.com/docs/cloud-messaging/android/client)
- [React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)

---

**Status**: ✅ Configuration complete - rebuild required
**Next Step**: Run `npx react-native run-android` to apply changes
