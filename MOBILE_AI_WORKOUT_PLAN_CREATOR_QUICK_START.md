# Mobile AI Workout Plan Creator - Quick Start Guide

## 🚀 Quick Start for Developers

### Open the Feature

```typescript
// In AITrainerScreen.tsx, the Create Plan button opens the modal:
<Pressable onPress={() => setShowWorkoutPlanCreator(true)}>
  <Icon name="dumbbell" size={20} color="#10b981" />
</Pressable>

// Modal component:
<WorkoutPlanCreator
  visible={showWorkoutPlanCreator}
  onClose={() => setShowWorkoutPlanCreator(false)}
  onComplete={(planId) => {
    // Handle completion
  }}
/>
```

### Component Props

```typescript
interface WorkoutPlanCreatorProps {
  visible: boolean; // Control modal visibility
  onClose: () => void; // Called when user closes modal
  onComplete?: (planId: string) => void; // Called when plan is saved
}
```

### API Usage

```typescript
// Create/continue conversation
const response = await apiClient.createWorkoutPlan({
  message: "User's workout request",
  conversationId: 'optional-existing-id',
});

// Approve or modify plan
const response = await apiClient.approveWorkoutPlan({
  conversationId: 'conv_123',
  message: 'yes, save this plan', // or modification request
});
```

## 📱 User Flow

### Step 1: Open Modal

User taps the dumbbell icon (🏋️) in AI Trainer screen header

### Step 2: Choose Entry Point

- **Option A**: Use Quick Start Template
  - "Build Muscle" - 4 days/week, 12 weeks
  - "Lose Weight" - 5 days/week, 8 weeks
  - "General Fitness" - 3 days/week, 6 weeks
- **Option B**: Type Custom Request
  - Example: "I want a beginner workout plan for building strength, 3 times per week for 8 weeks"

### Step 3: Conversation

- AI asks clarifying questions
- User provides additional details
- Missing fields indicator shows what's still needed

### Step 4: Review Plan

- View complete plan structure
- See plan stats (duration, frequency, difficulty)
- Review exercises and sessions
- Check new exercises count

### Step 5: Approve or Modify

- **Approve**: Tap "Save This Plan" → Done!
- **Modify**: Tap "Modify" → Specify changes → Review again

### Step 6: Completion

- Success message displayed
- Auto-redirect to Workouts tab (optional)
- Plan appears in workout plans list

## 🎨 UI Components

### Colors

```typescript
// Gradient (Header, Buttons)
colors: ['#3B82F6', '#8B5CF6'];

// Success (Save button, completion)
('#10B981');

// User messages
('#3B82F6');

// Assistant messages
colors.surface(theme - based);
```

### Icons

```typescript
'dumbbell'; // Create plan button
'target'; // Build muscle template
'trending-up'; // Lose weight template
'calendar'; // General fitness template
'check-circle'; // Success states
'alert-circle'; // Warnings/info
'x'; // Close button
'arrow-right'; // Send button
'check'; // Approve button
```

### Stages

```typescript
type Stage =
  | 'input' // Initial prompt with quick starts
  | 'gathering' // Conversational Q&A
  | 'preview' // Plan review
  | 'saving' // (handled internally)
  | 'complete'; // Success screen
```

## 🔧 Configuration

### API Endpoints

```typescript
// In api.ts
POST / api / ai / workout - plan / create;
POST / api / ai / workout - plan / approve;
```

### Base URL

```typescript
// In api.ts
const baseUrl = 'https://d202qmtk8kkxra.cloudfront.net';
```

### Authentication

```typescript
// Automatically handled by apiClient
// Uses JWT token from AsyncStorage
headers: {
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json'
}
```

## 🐛 Debugging

### Enable Logging

```typescript
// Add to component methods
console.log('State:', state);
console.log('Response:', response);
console.log('Conversation History:', conversationHistory);
```

### Check API Connection

```bash
# Test endpoints directly
curl -X POST https://your-api.com/api/ai/workout-plan/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test workout plan"}'
```

### Common Errors

```typescript
// Error: "Property 'post' does not exist"
❌ apiClient.post('/api/ai/workout-plan/create', {...})
✅ apiClient.createWorkoutPlan({...})

// Error: "Cannot read property 'message'"
❌ response.data.data.message
✅ response.data.message

// Error: "Invalid conversationId"
✅ Always check if conversationId exists before approve call
```

## 📦 File Locations

```
GymCoachClean/
├── src/
│   ├── components/
│   │   └── ai/
│   │       └── WorkoutPlanCreator.tsx     ✨ NEW
│   ├── screens/
│   │   └── AITrainerScreen.tsx            📝 MODIFIED
│   ├── services/
│   │   └── api.ts                         📝 MODIFIED
│   └── components/
│       └── common/
│           └── Icon.tsx                   📝 MODIFIED
```

## 🧪 Testing Commands

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Clear cache
npm start -- --reset-cache

# iOS pod install
cd ios && pod install && cd ..

# Android clean build
cd android && ./gradlew clean && cd ..
```

## 📋 Quick Test Script

```typescript
// Test workflow:
1. Open app → Navigate to AI Trainer
2. Tap dumbbell icon (top right)
3. Select "Build Muscle" quick start
4. Verify conversation starts
5. Respond to AI questions
6. Verify plan preview appears
7. Tap "Save This Plan"
8. Verify success message
9. Check Workouts tab for new plan
```

## 💡 Tips & Best Practices

### Performance

- Keep conversation history length reasonable (limit to 50 messages)
- Use ScrollView instead of FlatList for small lists
- Lazy load plan details in preview

### UX

- Always provide loading indicators during API calls
- Show clear error messages with retry options
- Use quick start templates to guide users
- Preview plan before database commit

### Code Quality

- Use TypeScript interfaces for all data structures
- Handle all error cases explicitly
- Test on both iOS and Android
- Follow existing code style and patterns

### Accessibility

- Ensure proper touch target sizes (44x44 minimum)
- Use semantic labels for screen readers
- Maintain color contrast ratios
- Support dynamic font sizes

## 🔗 Related Files

| File                   | Purpose           | Lines |
| ---------------------- | ----------------- | ----- |
| WorkoutPlanCreator.tsx | Main component    | 828   |
| AITrainerScreen.tsx    | Integration point | ~1650 |
| api.ts                 | API methods       | ~1110 |
| Icon.tsx               | Icon definitions  | ~75   |

## 📞 Support

**Issues?** Check:

1. Backend Lambda is deployed
2. API endpoints are accessible
3. JWT tokens are valid
4. Network connectivity is working
5. Console logs for detailed errors

**Need Help?** Review:

- MOBILE_AI_WORKOUT_PLAN_CREATOR.md (full documentation)
- AI_WORKOUT_PLAN_CREATOR_IMPLEMENTATION.md (backend)
- AI_WORKOUT_PLAN_CREATOR_ARCHITECTURE.md (architecture)

---

**Quick Reference Version**: 1.0  
**Last Updated**: January 2025
