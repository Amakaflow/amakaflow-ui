import {
  Rocket,
  Globe,
  Smartphone,
  Watch,
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

### Platform Overview

| Platform | What It Does |
|----------|--------------|
| **Web App** | Import workouts, edit exercises, manage your library, sync to devices |
| **iPhone App** | Browse synced workouts, remote control, start workouts on Watch |
| **Apple Watch** | Follow guided workouts with haptic feedback |
| **Garmin** | Run synced workouts on supported Garmin devices |

### Getting Help

If you run into any issues, check the [Troubleshooting](#troubleshooting) section or contact us at **support@amakaflow.com**.
    `,
    screenshots: [],
  },
  {
    id: "web-app",
    title: "Web App",
    icon: Globe,
    content: `
## Web App Guide

The AmakaFlow web app at **amakaflow.com** is where you import, edit, and manage your workouts.

---

### Importing Workouts

#### Supported Sources

| Platform | URL Format | Best For |
|----------|------------|----------|
| YouTube | youtube.com/watch?v=... | Full workout videos, tutorials |
| TikTok | tiktok.com/@user/video/... | Quick workout clips |
| Instagram | instagram.com/reel/... | Reels and video posts |

#### How to Import

**Step 1:** From the home screen, click **Import** in the sidebar

![Home screen with Import selected](/help/web-homescreen-import.png)

**Step 2:** You'll see the import screen - click **Add URL** to add a video

![Import start screen](/help/web-import-start.png)

**Step 3:** Paste a YouTube, TikTok, or Instagram workout URL

![Adding a YouTube URL](/help/web-import-add-url.png)

**Step 4:** The URL appears in your sources list - click **Extract Workout**

![URL added to sources](/help/web-import-url-added.png)

**Step 5:** Review the extracted workout with all exercises detected by AI

![Successfully imported workout](/help/web-import-success.png)

**Bulk Import:**
1. Go to **Import** > **Bulk Import**
2. Paste multiple URLs (one per line) or upload a text file
3. Click **Start Import**
4. Review each extracted workout

**Tips for Best Results:**
- Choose videos with clear exercise demonstrations
- Videos with on-screen text work best
- Longer videos (10-60 minutes) typically extract more accurately

---

### Managing Your Library

Access your workouts from **My Workouts** in the sidebar:

- **All Workouts** - Everything in your library
- **Favorites** - Starred workouts for quick access
- **Recent** - Recently imported or edited
- **Activity History** - View completed workout history

![My Workouts page](/help/web-my-workouts.png)

![Activity History tab](/help/web-activity-history.png)

---

### Editing a Workout

Click any workout to open the editor.

**Workout Settings:** Edit the workout name, default rest period, and warm-up options.

![Edit workout settings](/help/web-edit-workout.png)

**Exercise Settings:** Edit exercise name, sets/reps, rest periods, or duration.

![Edit exercise details](/help/web-edit-exercise.png)

![Edit exercise duration](/help/web-edit-duration.png)

**Adding Exercises:** Click **Add Exercise** to add new exercises from the wger database.

![Add exercise from wger](/help/web-add-exercise.png)

---

### Syncing to Devices

#### Apple Watch (via iPhone)

**Step 1:** Once your workout is complete, click **Export**

![Workout ready to sync](/help/web-sync-ready.png)

**Step 2:** Go to **Settings** > **Manage iOS Devices**

![Manage iOS devices](/help/web-manage-devices.png)

**Step 3:** Click **Generate Pairing Code** to show a QR code

![QR code for pairing](/help/web-qr-pairing.png)

**Step 4:** Scan the QR code with the AmakaFlow iPhone app

![Successful pairing](/help/web-pairing-success.png)

**Step 5:** Your workouts now sync automatically to paired devices

![Export destinations](/help/web-export-destinations.png)

#### Garmin Connect

1. Go to **Settings** > **Garmin** in the web app
2. Click **Connect Garmin Account**
3. Sign in to Garmin Connect and authorize
4. Sync workouts via **Export** > **Sync to Garmin**

#### Garmin USB Transfer

For devices without cloud sync:
1. Click **Export** > **Garmin FIT File**
2. Connect your Garmin via USB
3. Copy the .FIT file to \`GARMIN/WORKOUTS\` folder
    `,
    screenshots: [],
  },
  {
    id: "iphone-app",
    title: "iPhone App",
    icon: Smartphone,
    content: `
## iPhone App Guide

The AmakaFlow iOS app is your companion for browsing workouts and controlling your Apple Watch.

---

### Installing via TestFlight

AmakaFlow for iOS is currently in beta via Apple's TestFlight.

**Step 1: Get the Invitation**

You'll receive an email invitation to join the beta. Click the **View in TestFlight** link.

![TestFlight invitation email](/help/testflight-email.png)

**Step 2: Install TestFlight**

If you don't have TestFlight, the App Store will open. Tap **Get** to install.

![TestFlight in App Store](/help/testflight-install.png)

**Step 3: Install AmakaFlow**

Open TestFlight, find AmakaFlow, and tap **Install**.

![Install AmakaFlow in TestFlight](/help/testflight-amakaflow.png)

**Getting Updates:**
- TestFlight notifies you when updates are available
- Beta builds expire after 90 days - keep updated!

---

### Pairing with the Web App

To sync workouts from amakaflow.com:

**Step 1:** Open the AmakaFlow iOS app and go to **Settings**

**Step 2:** Tap **Pair with Web** - your camera opens to scan

![QR code scanner](/help/ios-qr-scan.png)

**Step 3:** Scan the QR code shown on the web app (Settings > Manage iOS Devices)

**Step 4:** You'll see the connection details once paired successfully

![Connection details](/help/ios-connection-details.png)

Once paired, your devices stay connected and workouts sync automatically.

---

### App Features

#### Home Screen

View all synced workouts and quick-start recent workouts with the play button.

![iPhone home screen](/help/ios-home.png)

#### Workout Preview

Tap any workout to see all exercises before starting.

![Workout preview](/help/ios-workout-preview.png)

Tap **Quick Start** to begin on your Apple Watch.

![Quick start pressed](/help/ios-quickstart.png)

#### Activity History

View completed workouts in the Activity tab.

![Activity history list](/help/ios-activity-list.png)

Tap any session to view detailed workout stats.

![Workout details](/help/ios-workout-details.png)

---

### Apple Watch Connection

#### Setting Up Your Watch

Go to **Settings** in the iOS app. The Apple Watch section shows your connection status.

![Watch settings](/help/ios-watch-settings.png)

#### Starting a Workout

1. Select a workout from the iOS app
2. Tap **Quick Start** or **Start on Watch**
3. The workout launches on your Apple Watch
4. Your iPhone shows the "waiting for watch" screen

![Waiting for watch](/help/ios-waiting-watch.png)

#### Remote Control

During a workout on Apple Watch, your iPhone becomes a remote control:

![Remote showing warmup](/help/ios-remote-warmup.png)

![Remote showing rest period](/help/ios-remote-rest.png)

- See the current exercise and timer
- View warm-up and rest periods
- Skip to next/previous exercise
- Pause and resume the workout
- End workout early if needed
    `,
    screenshots: [],
  },
  {
    id: "apple-watch",
    title: "Apple Watch",
    icon: Watch,
    content: `
## Apple Watch Guide

The AmakaFlow Watch app guides you through workouts with on-wrist prompts and haptic feedback.

---

### Opening the Watch App

Find **AmakaFlow-Watch** in your Watch app list.

![Watch app in list](/help/watch-app-list.png)

When you open the app, you'll see the home screen. If no workout is active, you'll see options to Refresh or run a Demo.

![Watch home screen](/help/remote-disconnected.png)

---

### Starting a Workout

**From iPhone (Recommended):**
1. Open the AmakaFlow iOS app
2. Select a workout
3. Tap **Quick Start** or **Start on Watch**
4. The workout begins automatically on your Watch

Once a workout starts, the Watch displays the current exercise.

---

### During a Workout

#### Exercise Screen

The watch shows your current exercise with timer and progress.

![Exercise screen](/help/remote-exercise.png)

![Warmup display](/help/remote-warmup.png)

- **Exercise name** at the top
- **Sets/Reps** or **Duration** in the center
- **Progress indicator** (e.g., 2/21 exercises)
- Navigation buttons to skip forward/back

#### Rest Periods

Between exercises you'll see rest screens:

![Rest screen](/help/remote-pause.png)

- Tap **Continue** when ready to proceed
- Or wait for the timer to complete

#### Pause/End Controls

Swipe or tap to access workout controls:

![End workout screen](/help/remote-end.png)

- **Pause** - Temporarily stop the workout
- **End Workout** - Finish and save your progress

---

### Native Watch Workouts (No iPhone Required)

If you prefer to run workouts directly on your Watch without using your iPhone, you can use the native workout feature. When workouts sync to your Watch, they appear in the standard Workouts app.

**To find your synced workouts:**
1. Open the **Workout** app on your Watch
2. Scroll to find **Traditional Strength Training** or your workout type
3. Your AmakaFlow workouts will appear here

![Native watch app](/help/watch-native-app.png)

**Starting the workout:**

Tap **Start** and you'll see a countdown before the workout begins.

![Workout countdown](/help/watch-countdown.png)

**During the workout:**

The Watch guides you through each exercise with timers and prompts.

![Watch showing warmup](/help/watch-warmup.png)

This method works completely offline and doesn't require your iPhone nearby.

---

### Workout Modes

#### Strength Mode
Best for weight training and bodyweight exercises.
- Exercises show **Sets × Reps** (e.g., "3 sets × 12 reps")
- Tap to mark each set complete
- Rest timer between sets

#### Timed Mode
Best for HIIT, circuits, yoga, and cardio.
- Exercises show **Duration** (e.g., "30 seconds")
- Countdown timer runs automatically
- Auto-advances to next exercise
- Haptic alert when time's up

AmakaFlow auto-detects the best mode based on the workout type.

---

### Haptic Feedback

Your watch vibrates to notify you:
- Exercise starting
- Rest period ending
- Set complete
- Workout complete

---

### Completing a Workout

When finished:
1. Summary screen shows total time and exercises
2. Heart rate data (if available)
3. Workout is saved to your activity history

**Ending Early:**
1. Tap **End Workout** from the controls
2. Partial workout is saved
    `,
    screenshots: [],
  },
  {
    id: "garmin",
    title: "Garmin",
    icon: Activity,
    content: `
## Garmin Guide

AmakaFlow supports Garmin fitness watches for guided workouts.

---

### Supported Devices

#### Garmin Connect Sync (Recommended)
- Forerunner 245, 255, 265, 745, 945, 955, 965
- Fenix 5, 6, 7 series
- Epix series
- Venu, Venu 2, Venu 3
- Enduro series

#### USB Transfer Only
- Forerunner 45, 55, 235
- Vivoactive 3, 4
- Older Fenix models

---

### Garmin Connect Integration

#### Connecting Your Account

1. Go to **Settings** in the AmakaFlow web app
2. Click **Connect Garmin**
3. Sign in to your Garmin Connect account
4. Authorize AmakaFlow access

#### Syncing a Workout

1. Open a workout in AmakaFlow
2. Click **Sync to Garmin**
3. Workout uploads to Garmin Connect
4. Open **Garmin Connect Mobile** on your phone
5. Sync your watch to download the workout

---

### USB Transfer Method

For devices without cloud sync:

**Step 1: Export the Workout**
1. Open workout in AmakaFlow
2. Click **Export** > **Garmin FIT**
3. Download the .FIT file

**Step 2: Transfer to Device**
1. Connect Garmin to computer via USB
2. Wait for it to appear as a drive
3. Copy the .FIT file to \`GARMIN/WORKOUTS\` folder
4. Safely eject the device

---

### Running a Workout on Garmin

1. From watch face, press **Start**
2. Select your activity type (e.g., Strength)
3. Press **Menu** (hold middle button)
4. Select **Training** > **Workouts**
5. Choose your AmakaFlow workout
6. Press **Start** to begin

**During the Workout:**
- Screen shows current exercise
- Rep/set count or duration
- Press **Lap** to advance
- Press **Stop** twice to end
    `,
    screenshots: [],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: HelpCircle,
    content: `
## Troubleshooting

### Web App Issues

#### "Failed to extract workout"
- Video may be private, region-restricted, or unsupported
- Try a different video URL
- Ensure the video is publicly accessible

#### "No exercises detected"
- AI couldn't identify exercises in the video
- Choose videos with clear demonstrations
- Videos with on-screen text work better

#### Import is taking too long
- Long videos take more time (up to 2 minutes)
- If stuck, refresh and try again

---

### iPhone App Issues

#### QR pairing not working
1. Ensure both devices are on the same network
2. Check camera permissions for the iOS app
3. Try regenerating the QR code
4. Restart both apps

#### Workouts not syncing
1. Pull down to refresh in the iOS app
2. Check your internet connection
3. Try disconnecting and reconnecting in Settings

---

### Apple Watch Issues

#### Workouts not appearing on Watch
1. Ensure iPhone and Watch are connected
2. Open iOS app and pull down to refresh
3. Check workout shows "Synced" status
4. Restart the Watch app if needed

#### App crashes during workout
1. Force close (press side button, swipe up)
2. Restart your Apple Watch
3. Reinstall via TestFlight if it persists

#### Exercises not advancing
- **Strength mode**: Tap to mark set complete
- **Timed mode**: Should auto-advance (check haptics are on)
- Swipe left to manually advance

---

### Garmin Issues

#### Sync fails
1. Check Garmin Connect connection in Settings
2. Ensure your Garmin account is properly linked
3. Try disconnecting and reconnecting
4. Use USB transfer as backup

#### Workout not on device
1. Open Garmin Connect Mobile app
2. Sync your watch manually
3. Check the workout appears in Garmin Connect first

---

### TestFlight Issues

#### "Build expired" error
- Beta builds expire after 90 days
- Check TestFlight for a newer version

#### Not receiving updates
1. Open TestFlight app
2. Check for available updates
3. Enable notifications for TestFlight

---

### Contact Support

Still having issues?

**Email:** support@amakaflow.com

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
