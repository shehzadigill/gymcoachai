# Profile Image & Progress Photos Implementation

## Overview

This implementation adds profile image and progress photo functionality to the GymCoach AI mobile app, allowing users to upload, view, edit, and delete photos.

## ✅ Implemented Features

### 1. Profile Image Upload

- **Location**: `ProfileScreen.tsx`
- **Functionality**:
  - Tap avatar to change profile image when in edit mode
  - Choose to take photo or select from library
  - Upload to S3 via presigned URL
  - Display profile image in avatar circle
  - Fallback to initials if no image

### 2. Progress Photos Screen

- **Location**: `ProgressPhotosScreen.tsx`
- **Functionality**:
  - View all progress photos in a grid layout
  - Upload new photos with notes and weight
  - Take photo with camera or choose from library
  - View photo details (date, weight, notes)
  - Delete progress photos
  - Pull-to-refresh functionality

### 3. Image Upload Service

- **Location**: `src/services/imageUpload.ts`
- **Functionality**:
  - Image picker interface (camera & library)
  - Permission handling for Android
  - Upload to S3 using presigned URLs
  - File type detection
  - Error handling

### 4. API Integration

- **Location**: `src/services/api.ts`
- **New Methods**:
  - `generateProfileImageUploadUrl()` - Get presigned URL for profile image
  - `updateProfileImage()` - Update user profile with new image URL
  - `getProgressPhotos()` - Fetch all progress photos
  - `generateProgressPhotoUploadUrl()` - Get presigned URL for progress photo
  - `updateProgressPhoto()` - Update photo metadata (notes, weight)
  - `deleteProgressPhoto()` - Delete a progress photo
  - `getProgressPhotoAnalytics()` - Get photo analytics
  - `getProgressPhotoTimeline()` - Get photo timeline view

### 5. Type Definitions

- **Location**: `src/types/index.ts`
- **New Types**:
  - Added `profileImageUrl` to `UserProfile` interface
  - Created `ProgressPhoto` interface

## 📦 Required Dependencies

### Core Dependencies (Already Installed)

✅ react-native (0.73.4)
✅ @react-native-async-storage/async-storage
✅ react-native-permissions

### **REQUIRED TO INSTALL**

You need to install these packages for full functionality:

```bash
# Install image picker
npm install react-native-image-picker
# OR
yarn add react-native-image-picker

# Install image resizer (optional but recommended)
npm install react-native-image-resizer
# OR
yarn add react-native-image-resizer

# iOS only - install pods
cd ios && pod install && cd ..
```

## 🔧 Setup Instructions

### Step 1: Install Dependencies

```bash
cd /Users/babar/projects/gymcoach-ai/GymCoachClean
npm install react-native-image-picker react-native-image-resizer
```

### Step 2: Configure Permissions

#### iOS (ios/GymCoachClean/Info.plist)

Add these permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take progress photos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to select progress photos</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>We need permission to save photos to your library</string>
```

#### Android (android/app/src/main/AndroidManifest.xml)

Add these permissions:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
                 android:maxSdkVersion="28" />
```

### Step 3: Update Image Upload Service

Replace the placeholder implementation in `src/services/imageUpload.ts` with the actual react-native-image-picker implementation:

```typescript
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

async function pickImageNative(
  fromCamera: boolean,
): Promise<ImagePickerResponse | null> {
  try {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    const result = fromCamera
      ? await launchCamera(options)
      : await launchImageLibrary(options);

    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Image picker error');
    }

    const asset = result.assets?.[0];
    if (!asset || !asset.uri) {
      return null;
    }

    return {
      uri: asset.uri,
      type: asset.type,
      name: asset.fileName,
      fileSize: asset.fileSize,
    };
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
}
```

### Step 4: Add Progress Photos to Navigation

Update `src/navigation/AppNavigator.tsx`:

```typescript
import ProgressPhotosScreen from '../screens/ProgressPhotosScreen';

// In your tab navigator or stack navigator:
<Tab.Screen
  name="ProgressPhotos"
  component={ProgressPhotosScreen}
  options={{
    tabBarLabel: 'Progress',
    tabBarIcon: ({color, size}) => (
      <Icon name="image" size={size} color={color} />
    ),
  }}
/>;
```

### Step 5: Test the Implementation

1. **Profile Image**:

   - Go to Profile screen
   - Tap "Edit" button
   - Tap on avatar
   - Choose "Take Photo" or "Choose from Library"
   - Verify image uploads and displays

2. **Progress Photos**:
   - Navigate to Progress Photos screen
   - Tap "Add Photo" button
   - Add optional notes and weight
   - Take/select photo
   - Verify photo appears in grid
   - Tap photo to view details
   - Test delete functionality

## 🏗️ Architecture

### Upload Flow

```
1. User Action (Profile/Progress Photo)
   ↓
2. Request Upload URL from API
   ← API returns: {upload_url, key, bucket_name}
   ↓
3. Pick Image (Camera/Library)
   ↓
4. Upload Image to S3 (presigned URL)
   ↓
5. Update User Profile/Photo Record
   ← API stores key reference
   ↓
6. Refresh UI with new image URL
```

### API Endpoints Used

- `POST /api/user-profiles/profile/upload` - Get profile image upload URL
- `PUT /api/user-profiles/profile` - Update profile with image key
- `GET /api/analytics/progress-photos/:userId` - Get all progress photos
- `POST /api/analytics/progress-photos/:userId/upload` - Get progress photo upload URL
- `PUT /api/analytics/progress-photos/:photoId` - Update photo metadata
- `DELETE /api/analytics/progress-photos/:userId/:photoId` - Delete photo

## 📝 Known Limitations & TODOs

### Current Limitations

1. **Image Picker**: Using placeholder implementation until react-native-image-picker is installed
2. **Image Resizing**: Not implemented - images upload at original size
3. **Offline Support**: No offline queue for uploads
4. **Compression**: No automatic compression before upload

### Future Enhancements

- [ ] Add image compression before upload
- [ ] Implement image cropping functionality
- [ ] Add multiple image selection for batch upload
- [ ] Add progress indicators for uploads
- [ ] Implement retry logic for failed uploads
- [ ] Add image filters/editing
- [ ] Implement comparison view (before/after)
- [ ] Add share functionality
- [ ] Cache images locally for offline viewing

## 🐛 Troubleshooting

### Issue: "Image Picker not implemented"

**Solution**: Install `react-native-image-picker` package

### Issue: Permission denied errors

**Solution**: Check Info.plist (iOS) and AndroidManifest.xml (Android) have correct permissions

### Issue: Upload fails with 403

**Solution**: Check presigned URL hasn't expired (valid for 5 minutes)

### Issue: Profile image doesn't display

**Solution**:

- Check network connectivity
- Verify S3 URL is accessible
- Check CloudFront distribution is working

### Issue: Large images take long to upload

**Solution**: Install and configure `react-native-image-resizer` to compress before upload

## 🔐 Security Notes

- Presigned URLs expire after 5 minutes (configurable in backend)
- Images are uploaded directly to S3 (not through API Gateway)
- CloudFront URLs are permanent and publicly accessible
- User authentication required for all API calls
- Profile images stored at: `s3://bucket/user-profiles/{uuid}.{ext}`
- Progress photos stored at: `s3://bucket/progress-photos/{uuid}.{ext}`

## 📱 Testing Checklist

### Profile Image

- [ ] Take photo with camera
- [ ] Choose from photo library
- [ ] Image displays correctly in avatar
- [ ] Edit mode shows edit badge
- [ ] Refresh updates image
- [ ] Works on both iOS and Android

### Progress Photos

- [ ] View existing photos in grid
- [ ] Upload new photo with notes
- [ ] Upload new photo with weight
- [ ] View photo details
- [ ] Delete photo works
- [ ] Pull-to-refresh works
- [ ] Empty state shows correctly
- [ ] Works offline (cached photos)

## 📚 Additional Resources

- [React Native Image Picker Docs](https://github.com/react-native-image-picker/react-native-image-picker)
- [React Native Permissions](https://github.com/zoontek/react-native-permissions)
- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)

## 🎉 Next Steps

1. Install required dependencies
2. Update imageUpload.ts with actual implementation
3. Add to navigation
4. Test on both iOS and Android devices
5. Deploy backend changes (already done ✅)
6. Monitor CloudWatch logs for any issues

---

**Implementation Date**: October 19, 2025
**Backend Status**: ✅ Deployed
**Frontend Status**: 🚧 Requires `react-native-image-picker` installation
