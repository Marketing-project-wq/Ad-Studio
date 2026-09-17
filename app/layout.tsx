import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from './providers';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: '20FIT Ad Studio',
  description:
    'AI-powered ad copy, banner, and campaign tracking tool for the 20FIT digital marketing team.',
  icons: {
    icon: 'https://media.20fit.id/wp-content/uploads/2026/04/20FITcolor.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E4002B',
};

// Runs before hydration to apply the saved theme and avoid a flash.
const themeInit = `(function(){try{var t=localStorage.getItem('20fit_theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
