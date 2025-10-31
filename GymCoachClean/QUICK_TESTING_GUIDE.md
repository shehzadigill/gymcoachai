# Quick Testing Guide

## Build and Run

```bash
# Terminal 1 - Start Metro Bundler
cd /Users/babar/projects/gymcoach-ai/GymCoachClean
npm start

# Terminal 2 - Build and Run (after Metro is ready)
cd /Users/babar/projects/gymcoach-ai/GymCoachClean
npx react-native run-ios --simulator="iPhone 16 Pro"
```

## Priority Testing Checklist

### 🔴 CRITICAL (Must Test)

#### 1. AI Trainer Screen - No Crash

- [ ] Open AI Trainer screen
- [ ] Verify screen loads without crashing
- [ ] Check console for warnings (not errors)
- [ ] Verify default coaching style appears

#### 2. Progress Photos - Image Upload

- [ ] Tap "Add Photo" button
- [ ] Select "Take Photo" or "Choose from Library"
- [ ] Select/take an image
- [ ] Add optional notes and weight
- [ ] Tap "Upload"
- [ ] Verify photo appears in grid
- [ ] Verify photo stored on S3

### 🟡 HIGH (Should Test)

#### 3. Quick Workout Flow

- [ ] Tap "Start Quick Workout"
- [ ] Add 2-3 exercises
- [ ] Complete first set of each exercise
- [ ] Tap "Complete Workout"
- [ ] Verify success message
- [ ] Check workout appears in history

#### 4. Analytics Display

- [ ] Open Analytics screen
- [ ] Verify stats display correctly
- [ ] Check streak calculation
- [ ] View body measurements tab
- [ ] View achievements tab

### 🟢 MEDIUM (Nice to Test)

#### 5. Workout Plans

- [ ] View workout plans tab
- [ ] Create new plan
- [ ] Schedule a plan
- [ ] Start session from plan

#### 6. Exercise Library

- [ ] Browse exercises
- [ ] Search exercises
- [ ] Filter by category
- [ ] View exercise details

## Issues to Watch For

### Expected Warnings (OK)

```
⚠️ Personalization profile not available
⚠️ Memories not available
⚠️ Proactive insights not available
⚠️ RAG stats not available
```

These are normal when AI backend is unavailable.

### Real Errors (NOT OK)

```
❌ Cannot read property 'x' of undefined
❌ Unhandled promise rejection
❌ Network request failed with no retry
❌ App crashes or freezes
```

## Quick Fixes if Issues Occur

### App Won't Load

```bash
# Clean and rebuild
cd /Users/babar/projects/gymcoach-ai/GymCoachClean
rm -rf ios/build
cd ios && pod install && cd ..
npm start
npx react-native run-ios --simulator="iPhone 16 Pro"
```

### Metro Bundle Error

```bash
# Kill and restart Metro
killall node
npm start
```

### Image Picker Not Working

```bash
# Rebuild with new permissions
cd ios && pod install && cd ..
npx react-native run-ios
```

## Success Criteria

✅ AI Trainer opens without crash  
✅ Progress photos can be uploaded  
✅ Workouts can be completed  
✅ Analytics display data  
✅ No console errors (warnings are OK)

## Files Modified (For Reference)

1. `src/screens/AITrainerScreen.tsx` - Error handling
2. `src/services/imageUpload.ts` - Image picker implementation
3. `ios/GymCoachClean/Info.plist` - Camera/photo permissions
4. `package.json` - Added react-native-image-picker

## Rollback Instructions (If Needed)

```bash
git diff src/screens/AITrainerScreen.tsx
git diff src/services/imageUpload.ts
git diff ios/GymCoachClean/Info.plist
git diff package.json

# To rollback specific file:
git checkout HEAD -- <filename>
```
