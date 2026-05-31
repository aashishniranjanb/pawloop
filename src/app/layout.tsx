import type { Metadata, Viewport } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import Providers from '@/components/providers';
import './globals.css';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  variable: '--font-fira-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'PawLoop — Urban Animal Support Network',
  description:
    'A smart urban ecosystem connecting food redistribution, animal welfare, clean feeding infrastructure, and community volunteers through a real-time map.',
  keywords: [
    'animal welfare',
    'stray animals',
    'feeding stations',
    'community volunteers',
    'urban sustainability',
    'PawLoop',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PawLoop',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1F6F50',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable} dark`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-body">
        <Providers>
          <main className="h-screen w-screen overflow-hidden relative">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
