import type { CapacitorConfig } from '@capacitor/cli'

// Production server URL — set CAPACITOR_SERVER_URL in your environment to
// override (e.g. in CI or when the Vercel domain changes).
// Falls back to the HappySeeds preview URL so the app works out of the box.
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  'https://13000-irwem1lfbz0ejkitkp9w3-dfc00ec5.preview.happyseeds.space'

const config: CapacitorConfig = {
  appId: 'com.ffcommunityarena.app',
  appName: 'FF Community Arena',
  webDir: 'out',
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: ['*.happyseeds.space', '*.vercel.app'],
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
