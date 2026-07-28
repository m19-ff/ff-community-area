# FF Community Arena — Android Release Builds

## Artifacts

| File | Type | Size | Purpose |
|------|------|------|---------|
| `FFCommunityArena-v1.0.0-release.apk` | Signed APK | ~6.5 MB | Direct install on Android devices |
| `FFCommunityArena-v1.0.0-release.aab` | App Bundle | ~8.4 MB | Google Play Store upload |

## APK Details

- **Package ID:** `com.ffcommunityarena.app`
- **Version:** 1.0.0 (versionCode 1)
- **Min Android:** API 24 (Android 7.0 Nougat)
- **Target Android:** API 36 (Android 16)
- **Signed:** Yes — APK Signature Scheme v2 ✅
- **Architecture:** Universal (all ABIs)

## Native Plugins

| Plugin | Purpose |
|--------|---------|
| `@capacitor/push-notifications` | FCM push notifications |
| `@capacitor/camera` | Camera + photo library access |
| `@capacitor/filesystem` | Download files, save screenshots |
| `@capacitor/splash-screen` | Custom FF Arena splash on launch |
| `@capacitor/status-bar` | Dark status bar (#0a0a0a) |
| `@capacitor/app` | App lifecycle, back button, deep links |
| `@capacitor/network` | Offline detection |
| `@capacitor/preferences` | Persistent login token storage |
| `@capacitor/share` | Share tournament results |
| `@capacitor/browser` | In-app browser for external links |
| `@capacitor/haptics` | Haptic feedback on actions |

## Keystore

- **File:** `ff-arena-release.keystore` (in project root)
- **Alias:** `ff-arena-key`
- **Password:** `FFArena2025!`
- **Validity:** 10,000 days (from 2025)
- **Algorithm:** RSA 2048-bit, SHA256withRSA

⚠️ Keep the keystore file safe — it is required for all future updates.

## How to Install (Direct APK)

1. Transfer `FFCommunityArena-v1.0.0-release.apk` to your Android device
2. Open **Settings → Security → Install from unknown sources** and enable it
3. Open the APK file and tap **Install**

## How to Upload to Google Play

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app with package ID `com.ffcommunityarena.app`
3. Upload `FFCommunityArena-v1.0.0-release.aab` in Production → Releases
4. Complete store listing, content rating, and pricing
5. Submit for review

## Rebuild Commands

```bash
cd android

# Release APK
./gradlew assembleRelease --no-daemon

# App Bundle (AAB) for Google Play
./gradlew bundleRelease --no-daemon

# Debug APK (for testing)
./gradlew assembleDebug --no-daemon
```

Output locations:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
