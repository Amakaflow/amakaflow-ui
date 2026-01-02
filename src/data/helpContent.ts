import {
  Rocket,
  Smartphone,
  Download,
  Settings,
  RefreshCw,
  AppWindow,
  Watch,
  Dumbbell,
  Activity,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export interface HelpSection {
  id: string;
  title: string;
  icon: LucideIcon;
  content: string;
  screenshots: string[];
}

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    content: `
## What is AmakaFlow?

AmakaFlow transforms workout videos from YouTube, TikTok, and Instagram into structured workouts you can follow on your Apple Watch or Garmin device.

### How It Works

1. **Import** - Paste a workout video URL and our AI extracts the exercises
2. **Review** - Check and customize the workout structure, rest periods, and exercise details
3. **Sync** - Send the workout to your Apple Watch or Garmin device
4. **Execute** - Follow along with guided prompts on your wrist

### Key Features

- **AI-Powered Extraction** - Automatically detects exercises, sets, reps, and durations
- **Multi-Platform Support** - Works with Apple Watch, Garmin devices, and iOS
- **Workout Library** - Save and organize your favorite workouts
- **Calendar Integration** - Plan your training schedule
- **Remote Control** - Control your Apple Watch workout from your iPhone

### Supported Platforms

| Platform | Features |
|----------|----------|
| Apple Watch | Full workout guidance, haptic feedback, heart rate tracking |
| iOS Companion | Remote control, workout browser, Dynamic Island |
| Garmin | Workout sync via Connect or USB transfer |
| Web App | Import, edit, organize, and sync workouts |

### Getting Help

If you run into any issues, check the [Troubleshooting](#troubleshooting) section or contact us at **support@amakaflow.com**.
    `,
    screenshots: [],
  },
  {
    id: "testflight-setup",
    title: "TestFlight Setup",
    icon: Smartphone,
    content: `
## Installing the iOS App via TestFlight

AmakaFlow for iOS is currently in beta testing via Apple's TestFlight program.

### Step 1: Install TestFlight

1. Open the **App Store** on your iPhone
2. Search for "**TestFlight**"
3. Tap **Get** to install the free app

### Step 2: Accept Your Invitation

After signing up for the beta, you'll receive an email with a TestFlight invitation:

1. Open the email on your iPhone
2. Tap **View in TestFlight**
3. Accept the invitation to join the beta

Alternatively, if you have a **public link**:
1. Open the link in Safari on your iPhone
2. Tap **Accept** when prompted
3. TestFlight will open automatically

### Step 3: Install AmakaFlow

1. Open **TestFlight**
2. Find **AmakaFlow** in your available apps
3. Tap **Install**
4. Wait for the download to complete

### Getting Updates

TestFlight automatically notifies you when new beta versions are available:

- You'll see a notification on your device
- Open TestFlight and tap **Update**
- New features and bug fixes are released regularly

### Beta Feedback

You can send feedback directly from TestFlight:

1. Take a screenshot in the app
2. Shake your device to open the feedback form
3. Describe the issue or suggestion
4. Tap **Submit**

> **Note**: Beta versions expire after 90 days. Make sure to update when new versions are available.
    `,
    screenshots: [
      "testflight-appstore.png",
      "testflight-invite.png",
      "testflight-install.png",
    ],
  },
  {
    id: "importing-workouts",
    title: "Importing Workouts",
    icon: Download,
    content: `
## Importing Workouts from Social Media

AmakaFlow can extract workouts from YouTube, TikTok, and Instagram videos.

### Supported Sources

| Platform | URL Format | Best For |
|----------|------------|----------|
| YouTube | youtube.com/watch?v=... | Full workout videos, tutorials |
| TikTok | tiktok.com/@user/video/... | Quick workout clips |
| Instagram | instagram.com/reel/... | Reels and video posts |

### How to Import

#### Single Import

1. Copy the video URL from your browser or app
2. Go to **Import** > **Single Import** in AmakaFlow
3. Paste the URL in the input field
4. Click **Extract Workout**
5. Wait for AI analysis (usually 30-60 seconds)

#### Bulk Import

For importing multiple workouts at once:

1. Go to **Import** > **Bulk Import**
2. Choose your import method:
   - **URLs** - Paste multiple URLs, one per line
   - **File** - Upload a text file with URLs
3. Click **Start Import**
4. Review each extracted workout

### Import Tips

**For Best Results:**
- Choose videos with clear exercise demonstrations
- Videos with on-screen text (exercise names, rep counts) work best
- Longer videos (10-60 minutes) typically extract more accurately

**Troubleshooting:**
- If extraction fails, try a different video URL
- Some videos may be region-restricted
- Private or age-restricted videos cannot be imported

### After Import

Once imported, you can:
- **Edit** exercises, sets, reps, and rest periods
- **Add** warm-up or cool-down sections
- **Remove** exercises you don't want
- **Reorder** the workout flow
- **Save** to your library
    `,
    screenshots: ["import-youtube.png"],
  },
  {
    id: "managing-workouts",
    title: "Managing Workouts",
    icon: Settings,
    content: `
## Managing Your Workout Library

After importing workouts, you can customize and organize them in your library.

### Browsing Your Library

Access your workouts from **My Workouts** in the navigation:

- **All Workouts** - View everything in your library
- **Favorites** - Quick access to starred workouts
- **Recent** - Recently imported or edited workouts
- **By Source** - Filter by YouTube, TikTok, or Instagram

### Editing a Workout

Click on any workout to open the editor:

#### Basic Settings
- **Title** - Name your workout
- **Description** - Add notes or instructions
- **Workout Type** - Strength, HIIT, Cardio, Yoga, etc.
- **Difficulty** - Beginner, Intermediate, Advanced

#### Exercise Settings
For each exercise, you can adjust:
- **Name** - Edit the exercise name
- **Sets** - Number of sets (for strength workouts)
- **Reps** - Repetitions per set
- **Duration** - Time-based exercises (seconds/minutes)
- **Rest** - Rest period after the exercise

#### Global Settings
- **Default Rest Period** - Set rest time between all exercises
- **Warm-up Sets** - Add warm-up sets to strength exercises
- **Auto-advance** - Automatically move to next exercise

### Workout Modes

AmakaFlow supports two workout modes:

| Mode | Best For | Guidance |
|------|----------|----------|
| **Strength** | Weight training, bodyweight | Sets × Reps, rest timers |
| **Timed** | HIIT, circuits, yoga | Duration-based, intervals |

The system automatically detects the best mode based on your workout content, but you can override this in settings.

### Deleting Workouts

To remove a workout:
1. Open the workout
2. Click the **...** menu
3. Select **Delete**
4. Confirm deletion

> **Warning**: Deleted workouts cannot be recovered.
    `,
    screenshots: ["edit-workout.png"],
  },
  {
    id: "syncing-devices",
    title: "Syncing to Devices",
    icon: RefreshCw,
    content: `
## Syncing Workouts to Your Devices

AmakaFlow supports syncing to Apple Watch and Garmin devices.

### Apple Watch Sync

#### Initial Setup (QR Pairing)

1. Open the **iOS Companion App** on your iPhone
2. Tap **Pair with Web** or go to Settings > Pair Device
3. On the web app, go to **My Workouts** > **Sync to Watch**
4. Scan the QR code with your iPhone camera
5. Confirm the pairing on both devices

Once paired, your devices stay connected automatically.

#### Syncing a Workout

1. Open the workout you want to sync
2. Click **Sync to Apple Watch**
3. The workout appears in your iOS app and Watch app

#### Sync Status

- **Synced** - Workout is on your watch
- **Pending** - Waiting to sync (requires iPhone connection)
- **Failed** - Sync error (check troubleshooting)

### Garmin Sync

AmakaFlow supports two methods for Garmin devices:

#### Method 1: Garmin Connect (Recommended)

1. Connect your Garmin account in Settings
2. Open the workout you want to sync
3. Click **Sync to Garmin**
4. The workout syncs via Garmin Connect
5. Open Garmin Connect on your phone to push to device

#### Method 2: USB Transfer

For devices without Garmin Connect sync:

1. Open the workout
2. Click **Export** > **Garmin FIT File**
3. Connect your Garmin device via USB
4. Copy the .FIT file to the \`GARMIN/WORKOUTS\` folder
5. Safely eject the device

### Supported Garmin Devices

| Series | Sync Method |
|--------|-------------|
| Forerunner (245+) | Garmin Connect |
| Fenix (5+) | Garmin Connect |
| Venu | Garmin Connect |
| Older models | USB Transfer |
    `,
    screenshots: ["qr-pairing.png", "garmin-sync.png"],
  },
  {
    id: "ios-companion",
    title: "iOS Companion App",
    icon: AppWindow,
    content: `
## iOS Companion App

The AmakaFlow iOS app works alongside your Apple Watch to provide a complete workout experience.

### Features

#### Workout Browser
- View all synced workouts
- Preview exercises before starting
- Quick-start workouts directly to your watch
- Search and filter your library

#### Remote Control
During an Apple Watch workout, use your iPhone to:
- See the current exercise
- Skip to next/previous exercise
- Pause and resume
- End the workout early
- View workout progress

#### Dynamic Island & Live Activities
On iPhone 14 Pro and newer:
- **Dynamic Island** shows current exercise while using other apps
- **Live Activity** on lock screen displays workout progress
- Tap to return to the full remote control

#### Workout History
- View completed workouts
- See duration, exercises completed, and heart rate data
- Track your progress over time

### Pairing with the Web App

To sync workouts from the web app:

1. Open the iOS app
2. Go to **Settings** > **Pair with Web**
3. A QR code will appear
4. On the web app, scan this code
5. Devices are now paired

Once paired, workouts sync automatically when you're on the same network.

### Starting a Workout

1. Open the iOS app
2. Browse or search for a workout
3. Tap the workout to preview
4. Tap **Start on Watch**
5. The workout begins on your Apple Watch

You can also start workouts directly from your Apple Watch.
    `,
    screenshots: [
      "ios-home.png",
      "ios-remote.png",
      "dynamic-island.png",
    ],
  },
  {
    id: "apple-watch",
    title: "Apple Watch App",
    icon: Watch,
    content: `
## Apple Watch App

The AmakaFlow Watch app guides you through workouts with on-wrist prompts and haptic feedback.

### Starting a Workout

1. Open **AmakaFlow** on your Apple Watch
2. Scroll through your synced workouts
3. Tap a workout to see details
4. Tap **Start** to begin

### During a Workout

#### Exercise Screen
The main workout screen shows:
- **Exercise name** at the top
- **Sets/Reps** or **Duration** in the center
- **Progress indicator** showing workout completion
- **Next exercise** preview at the bottom

#### Navigation
- **Swipe right** - Previous exercise
- **Swipe left** - Next exercise
- **Tap** - Mark set complete (strength mode)
- **Crown** - Scroll through exercise details

#### Rest Timer
Between exercises, you'll see:
- Countdown timer
- Next exercise preview
- Option to skip rest early

#### Haptic Feedback
Your watch vibrates to notify you:
- Exercise starting
- Rest period ending
- Set complete
- Workout complete

### Completing a Workout

When you finish all exercises:
1. A summary screen appears
2. Shows total time, exercises completed
3. Heart rate data (if available)
4. Tap **Done** to save

### Ending Early

To stop a workout before completion:
1. Swipe up from the bottom
2. Tap **End Workout**
3. Confirm your choice
4. Partial workout is saved
    `,
    screenshots: [
      "watch-list.png",
      "watch-exercise.png",
      "watch-rest.png",
      "watch-complete.png",
    ],
  },
  {
    id: "workout-modes",
    title: "Workout Modes",
    icon: Dumbbell,
    content: `
## Workout Modes Explained

AmakaFlow supports two primary workout modes, optimized for different training styles.

### Strength Mode

Best for: Weight training, bodyweight exercises, traditional gym workouts

#### How It Works
- Exercises are organized by **Sets × Reps**
- Example: "Bench Press - 3 sets × 10 reps"
- Tap to mark each set complete
- Rest timer starts between sets
- Move to next exercise after all sets done

#### On Your Watch
- Large rep count display
- Set counter (e.g., "Set 2 of 3")
- Tap anywhere to complete a set
- Automatic rest timer
- Crown scrolls to see exercise notes

#### Best Practices
- Set appropriate rest times (60-90s for hypertrophy, 2-3min for strength)
- Use warm-up sets for heavy compound movements
- Track weights in the exercise notes

### Timed Mode

Best for: HIIT, circuits, yoga, cardio, interval training

#### How It Works
- Exercises have a **Duration** (e.g., "30 seconds")
- Timer counts down automatically
- Auto-advances to next exercise
- Rest intervals between exercises

#### On Your Watch
- Large countdown timer
- Visual progress ring
- Haptic alert when time's up
- Auto-transition to rest/next exercise

#### Interval Training
For HIIT-style workouts:
- Work interval (e.g., 40 seconds)
- Rest interval (e.g., 20 seconds)
- Repeat for specified rounds

### Auto-Detection

AmakaFlow automatically detects the best mode based on:
- Exercise names (e.g., "Plank" → timed, "Squat" → strength)
- Video content analysis
- Rep/duration patterns

You can manually override the mode in workout settings.

### Mixed Workouts

Some workouts combine both modes:
- Strength exercises use sets × reps
- Cardio/core exercises use timed mode
- The watch adapts interface for each exercise
    `,
    screenshots: ["strength-mode.png", "timed-mode.png"],
  },
  {
    id: "garmin-guide",
    title: "Garmin Guide",
    icon: Activity,
    content: `
## Garmin Device Guide

AmakaFlow supports Garmin fitness watches for guided workouts.

### Supported Devices

#### Full Support (Garmin Connect Sync)
- Forerunner 245, 255, 265, 745, 945, 955, 965
- Fenix 5, 6, 7 series
- Epix series
- Venu, Venu 2, Venu 3
- Enduro series

#### USB Transfer Only
- Forerunner 45, 55, 235
- Vivoactive 3, 4
- Older Fenix models

### Garmin Connect Integration

#### Connecting Your Account

1. Go to **Settings** in AmakaFlow web app
2. Click **Connect Garmin**
3. Sign in to your Garmin Connect account
4. Authorize AmakaFlow access
5. Your account is now linked

#### Syncing Workouts

1. Open a workout in AmakaFlow
2. Click **Sync to Garmin**
3. Select your connected device
4. Workout uploads to Garmin Connect
5. Open Garmin Connect Mobile app
6. Sync your watch to download the workout

### USB Transfer Method

For devices without cloud sync:

1. **Export the Workout**
   - Open workout in AmakaFlow
   - Click **Export** > **Garmin FIT**
   - Download the .FIT file

2. **Connect Your Device**
   - Plug Garmin into computer via USB
   - Wait for it to appear as a drive

3. **Copy the File**
   - Navigate to \`GARMIN/WORKOUTS\` folder
   - Copy the .FIT file here
   - Safely eject the device

4. **Start the Workout**
   - On your Garmin, go to Training > Workouts
   - Find your imported workout
   - Select and start

### Running a Workout on Garmin

1. From watch face, press **Start**
2. Select your activity type (e.g., Strength)
3. Press **Menu** (hold middle button)
4. Select **Training** > **Workouts**
5. Choose your AmakaFlow workout
6. Press **Start** to begin

#### During the Workout
- Screen shows current exercise
- Rep/set count or duration
- Press **Lap** to advance
- Heart rate tracking
- Press **Stop** twice to end
    `,
    screenshots: ["garmin-sync.png", "garmin-workout.png"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: HelpCircle,
    content: `
## Troubleshooting Common Issues

### Import Issues

#### "Failed to extract workout"
- **Cause**: Video may be private, region-restricted, or unsupported format
- **Solution**: Try a different video URL, ensure the video is publicly accessible

#### "No exercises detected"
- **Cause**: AI couldn't identify exercises in the video
- **Solution**:
  - Choose videos with clear exercise demonstrations
  - Videos with on-screen text work better
  - Try a longer, more detailed workout video

#### Import is taking too long
- **Cause**: Long videos take more time to process
- **Solution**: Wait up to 2 minutes for longer videos. If still stuck, try again.

### Sync Issues

#### Workouts not appearing on Apple Watch
1. Ensure iPhone and Watch are connected
2. Open the iOS app and pull down to refresh
3. Check that the workout shows "Synced" status
4. Restart the Watch app if needed

#### QR pairing not working
1. Ensure both devices are on the same network
2. Check camera permissions for the iOS app
3. Try regenerating the QR code
4. Restart both apps and try again

#### Garmin sync fails
1. Check your Garmin Connect connection in Settings
2. Ensure your Garmin account is properly linked
3. Try disconnecting and reconnecting your account
4. Use USB transfer as a backup method

### Watch App Issues

#### App crashes during workout
1. Force close the app (press side button, swipe up on app)
2. Restart your Apple Watch
3. Reinstall via TestFlight if issue persists

#### Exercises not advancing
- In **Strength mode**: Tap to mark set complete
- In **Timed mode**: Should auto-advance (check sound/haptics are on)
- Swipe left to manually advance

#### Heart rate not tracking
1. Ensure watch is snug on wrist
2. Check Watch app has health permissions
3. Clean watch sensors and wrist

### TestFlight Issues

#### "Build expired" error
- **Cause**: Beta builds expire after 90 days
- **Solution**: Check TestFlight for a newer version and update

#### Not receiving updates
1. Open TestFlight app
2. Check for available updates
3. Enable notifications for TestFlight
4. Ensure you have storage space available

### Contact Support

If you're still experiencing issues:

**Email**: support@amakaflow.com

Please include:
- Device model and OS version
- Description of the issue
- Steps to reproduce
- Screenshots if possible
    `,
    screenshots: [],
  },
];

export const supportEmail = "support@amakaflow.com";
