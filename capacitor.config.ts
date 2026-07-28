import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ffcommunityarena.app',
  appName: 'FF Community Arena',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    // Production: point to your Vercel deployment
    url: 'https://ff-community-area.vercel.app',
    cleartext: false,
    // Allow all origins for the WebView
    allowNavigation: ['ff-community-area.vercel.app', '*.vercel.app'],
  },
  android: {
    buildOptions: {
      keystorePath: 'ff-arena-release.keystore',
      keystoreAlias: 'ff-arena-key',
    },
    // Allow HTTP in dev only — production uses HTTPS
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
