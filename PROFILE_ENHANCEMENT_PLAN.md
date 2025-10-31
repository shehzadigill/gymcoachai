# Profile Screen Enhancement - Implementation Plan

**Date**: October 30, 2025  
**Objective**: Port advanced features from web profile page to mobile ProfileScreen

---

## 📋 Web Profile Features Analysis

### Current Web Profile Tabs:

1. **Profile** - Basic info, profile image upload
2. **Preferences** - Units, timezone, notifications, privacy
3. **Goals** - Fitness goals, daily nutrition goals
4. **Body Measurements** - Weight, body fat, detailed measurements (chest, waist, hips, biceps, thighs, neck)
5. **AI Trainer** - Coaching preferences (comprehensive panel)
6. **Security** - Password management

---

## 📱 Current Mobile Profile Tabs:

1. **profile** - Basic info ✅
2. **goals** - Fitness goals ✅
3. **measurements** - Weight, body fat ⚠️ (missing detailed measurements)
4. **ai-trainer** - Basic coaching style ⚠️ (missing comprehensive preferences)
5. **settings** - Language, theme, notifications ✅

---

## 🎯 Missing Features in Mobile

### 1. **Profile Image Upload** ❌

Web has full S3 image upload with presigned URLs. Mobile has the upload logic but not integrated into ProfileScreen UI.

**Needed**:

- Profile image display
- Camera/gallery picker
- Upload to S3 with progress
- Image preview

### 2. **Detailed Body Measurements** ❌

Web tracks:

- Weight ✅
- Body fat ✅
- Muscle mass ❌
- Chest ❌
- Waist ❌
- Hips ❌
- Bicep (left/right) ❌
- Thigh (left/right) ❌
- Neck ❌

**Needed**:

- Extended measurement form
- Measurement history visualization
- Progress tracking for each measurement

### 3. **Comprehensive AI Coaching Preferences** ❌

#### Web AI Trainer Panel Features:

1. **Coaching Styles** (5 types):
   - Motivational (Heart icon)
   - Analytical (Brain icon)
   - Educational (BookOpen icon)
   - Supportive (Shield icon)
   - Challenging (Zap icon)
   - Each with description, characteristics, and example

2. **Communication Frequency**:
   - Daily
   - Weekly
   - On-Demand

3. **Motivation Types**:
   - Achievement
   - Social
   - Personal
   - Competitive

4. **Focus Areas** (Multi-select):
   - Strength Training
   - Cardio
   - Flexibility
   - Weight Loss
   - Muscle Gain
   - Endurance
   - Sports Performance

5. **Equipment Available** (Multi-select):
   - Dumbbells
   - Barbell
   - Resistance Bands
   - Pull-up Bar
   - Kettlebells
   - Gym Access
   - etc.

6. **Workout Preferences**:
   - Duration preference (minutes slider)
   - Days per week (number picker)

7. **Injury History** (Text input):
   - List of past injuries
   - Helps AI avoid problematic exercises

8. **Nutrition Preferences**:
   - Meal preferences (vegetarian, vegan, etc.)
   - Allergies
   - Supplement preferences

9. **Personalization Profile Display**:
   - Shows AI-generated coaching profile
   - Confidence indicator
   - Style traits
   - Preferred topics
   - Communication patterns

**Mobile Currently Has**:

- Basic coaching style (4 types: motivational, strict, balanced, technical)
- Communication frequency (3 types)
- Focus areas (simple list)

**Missing**:

- Motivation types
- Detailed coaching style descriptions with icons
- Equipment preferences
- Workout duration/frequency preferences
- Injury history
- Nutrition preferences (meal types, allergies, supplements)
- Personalization profile visualization
- Style examples and characteristics

### 4. **Privacy & Notification Preferences** ⚠️

Web has:

- Profile visibility (public/private/friends)
- Workout sharing toggle
- Progress sharing toggle
- Email notifications toggle
- Push notifications toggle
- Workout reminders toggle
- Nutrition reminders toggle

Mobile has:

- Basic notification toggles
- Missing privacy controls

### 5. **Units & Timezone Preferences** ❌

Web has:

- Metric/Imperial toggle
- Timezone selector

Mobile: Missing

### 6. **Security Tab** ❌

Web has:

- Password change form
- Current password verification
- Password strength indicator

Mobile: Missing (though logout exists)

---

## 🎨 Components to Create

### 1. ProfileImagePicker.tsx

```typescript
- Display current profile image or placeholder
- Touch to open picker (camera or gallery)
- Upload progress indicator
- S3 upload integration
```

### 2. DetailedMeasurementsForm.tsx

```typescript
- Extended measurement fields
- Grouped by category (torso, arms, legs)
- Visual body diagram (optional)
- Save multiple measurements
```

### 3. CoachingStyleSelector.tsx

```typescript
- Grid of coaching style cards
- Icons for each style
- Description and characteristics
- Example messages
- Selection highlight
```

### 4. EquipmentSelector.tsx

```typescript
- Multi-select checkboxes
- Equipment icons
- Common equipment categories
- Custom equipment input
```

### 5. InjuryHistoryInput.tsx

```typescript
- List of injuries with dates
- Add/remove injuries
- Notes for each injury
- Affects exercise recommendations
```

### 6. NutritionPreferences.tsx

```typescript
- Dietary restrictions (multi-select)
- Allergies list
- Supplement preferences
- Meal timing preferences
```

### 7. PersonalizationProfileCard.tsx

```typescript
- Display AI coaching profile
- Confidence score
- Style traits visualization
- Preferred communication topics
- Update trigger button
```

---

## 🔧 API Methods Status

### Already Available:

- ✅ `uploadImageToS3()` - Image upload to S3
- ✅ `generateUploadUrl()` - Get presigned URL
- ✅ `updateUserProfile()` - Update profile
- ✅ `getUserPreferences()` - Get preferences
- ✅ `updateUserPreferences()` - Update preferences
- ✅ `getBodyMeasurements()` - Get measurements
- ✅ `createBodyMeasurement()` - Create measurement
- ✅ `updateFitnessGoals()` - Update goals
- ✅ `getPersonalizationProfile()` - Get AI profile (from AITrainerScreen)

### Need to Add:

- ❌ `updatePassword()` - Change password
- ❌ `deleteBodyMeasurement()` - Delete measurement

---

## 📋 Implementation Strategy

### Phase 1: Profile Image Upload ⭐ HIGH PRIORITY

1. Create ProfileImagePicker component
2. Integrate camera/gallery picker
3. Add S3 upload with progress
4. Update profile with image URL
5. Display in profile header

### Phase 2: Detailed Body Measurements ⭐ HIGH PRIORITY

1. Create DetailedMeasurementsForm component
2. Add all measurement fields
3. Update measurement save logic
4. Add measurement history view
5. Progress charts for each measurement

### Phase 3: Enhanced AI Coaching Preferences ⭐ MEDIUM PRIORITY

1. Create CoachingStyleSelector with 5 styles
2. Add motivation type selector
3. Create EquipmentSelector component
4. Add workout preference sliders
5. Create InjuryHistoryInput
6. Create NutritionPreferences panel
7. Add PersonalizationProfileCard

### Phase 4: Privacy & Advanced Preferences ⭐ LOW PRIORITY

1. Add privacy settings section
2. Add units (metric/imperial) toggle
3. Add timezone selector
4. Expand notification preferences

### Phase 5: Security Tab ⭐ LOW PRIORITY

1. Create password change form
2. Add password validation
3. Add current password verification

---

## 🎯 Mobile-Specific Enhancements

### Better Tab UI:

- Use icon tabs instead of text-only
- Swipeable tabs
- Badge indicators for incomplete sections

### Native Features:

- Use native image picker (expo-image-picker)
- Use native date picker for birth date
- Use native slider for preferences
- Use native switches for toggles

### Optimizations:

- Lazy load tabs
- Cache preferences locally
- Optimistic UI updates
- Pull-to-refresh support

---

## 📊 Priority Implementation Order

1. **Profile Image Upload** - Most visible improvement
2. **Detailed Body Measurements** - High user value
3. **Enhanced AI Coaching Preferences** - Key differentiator
4. **Privacy Settings** - Important for trust
5. **Security Tab** - Nice to have

---

## 🚀 Today's Focus

**Start with Profile Image Upload**:

- Users immediately see the improvement
- Builds on existing upload infrastructure
- Quick win for user experience

**Then Detailed Measurements**:

- High value for fitness tracking
- Uses existing measurement API
- Visual progress tracking

---

**Status**: Ready to implement
**Estimated Time**:

- Phase 1: 1 hour
- Phase 2: 1.5 hours
- Phase 3: 2-3 hours
- Phase 4: 1 hour
- Phase 5: 1 hour

**Total**: ~7 hours for complete parity
