'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Msarch App</title>
        <meta name="description" content="Aplikasi manajemen proyek dan tugas karyawan" />
        <meta name="theme-color" content="#1A237E" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/msarch-logo.png?v=5" />
        <link rel="shortcut icon" href="/msarch-logo.png?v=5" />
        <link rel="apple-touch-icon" href="/msarch-logo.png?v=5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Msarch App" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </AuthProvider>
        <Script id="service-worker-registration">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                  console.log('Service Worker registered with scope:', registration.scope);
                }).catch(error => {
                  console.error('Service Worker registration failed:', error);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
