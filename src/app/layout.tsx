import type { Metadata, Viewport } from 'next';
import Script from "next/script";
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { HappySeedsWatermark } from '@/components/HappySeedsWatermark';
import InstallBanner from '@/components/ui/InstallBanner';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-var',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FF Community Arena | Free Fire Tournament Platform',
  description: 'Compete, win, and dominate. The ultimate Free Fire esports tournament management platform for teams, scrims, and championships.',
  keywords: 'free fire, FF, esports, tournament, gaming, competitive, team, scrim, battle royale',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FF Community Arena',
  },
  icons: {
    icon: [
      { url: '/favicon.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#e11d48',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        {process.env.NODE_ENV === 'production' && (
          <Script
            async
            src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </head>
      <body>
        {children}
        <HappySeedsWatermark />
        <InstallBanner />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
