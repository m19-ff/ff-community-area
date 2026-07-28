import type { CapacitorConfig } from '@capacitor/cli'

// The WebView loads the production Vercel deployment.
// All API calls (/api/*) go to this origin — no bundled assets needed
// since the app requires a live backend (auth, DB, tournaments, etc.).
const config: CapacitorConfig = {
  appId: 'com.ffcommunityarena.app',
  appName: 'FF Community Arena',
  webDir: 'out',
  server: {
    url: 'https://ff-community-area-jc9v.vercel.app',
    cleartext: false,
    allowNavigation: [
      'ff-community-area-jc9v.vercel.app',
      '*.vercel.app',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Filesystem: {
      permissions: ['storage'],
    },
  },
}

export default config
