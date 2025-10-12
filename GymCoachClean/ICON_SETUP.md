# Icon Setup Guide for React Native Vector Icons

## Current Issue

The Material Icons are showing as question marks because the font files are not properly linked to the iOS project.

## Quick Fix (Current Implementation)

I've replaced the vector icons with emoji/text-based icons that work immediately without any setup.

## To Use Vector Icons Instead

### For iOS:

1. **Add Font Files to iOS Project:**
   ```bash
   cd ios && open GymCoachClean.xcworkspace
   ```
2. **In Xcode:**

   - Right-click on the project in the navigator
   - Select "Add Files to GymCoachClean"
   - Navigate to `node_modules/react-native-vector-icons/Fonts`
   - Select `MaterialIcons.ttf`
   - Make sure "Add to target" is checked for your app target

3. **Update Info.plist:**
   Add this to your `ios/GymCoachClean/Info.plist`:

   ```xml
   <key>UIAppFonts</key>
   <array>
     <string>MaterialIcons.ttf</string>
   </array>
   ```

4. **Clean and Rebuild:**
   ```bash
   cd ios && xcodebuild clean
   cd .. && npx react-native run-ios
   ```

### Alternative: Use Expo Vector Icons

If you're using Expo or want a simpler solution:

```bash
npm install @expo/vector-icons
```

Then replace the import:

```typescript
import {MaterialIcons} from '@expo/vector-icons';
```

## Current Text-Based Icons

The current implementation uses these emoji/text icons:

- 🤖 smart-toy (AI Trainer)
- 💬 chat (Conversations)
- 🔄 refresh (New conversation)
- ✕ close (Close drawer)
- ✏️ edit (Edit conversation)
- 🗑️ delete (Delete conversation)
- ✓ check (Save)
- ➤ send (Send message)
- ⚡ flash-on (Rate limit)

These work immediately without any additional setup and provide a clean, modern look.
