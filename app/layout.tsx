import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import InstallPrompt from "@/components/ui/InstallPrompt";
import { SkipLink } from "@/components/layout/SkipLink";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // 모노폰트는 필요시에만 로드
});

export const metadata: Metadata = {
  title: "TimeLevelUp - 학습 관리 시스템",
  description: "효율적인 학습 계획 및 성적 관리 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TimeLevelUp",
    startupImage: [
      // iPhone SE (2nd generation), iPhone 8/7/6s/6
      "/splash/apple-splash-750-1334.png",
      // iPhone 8 Plus/7 Plus/6s Plus/6 Plus
      {
        url: "/splash/apple-splash-1242-2208.png",
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone X/XS, iPhone 11 Pro, iPhone 12 mini, iPhone 13 mini
      {
        url: "/splash/apple-splash-1125-2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone XR, iPhone 11
      {
        url: "/splash/apple-splash-828-1792.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPhone XS Max, iPhone 11 Pro Max
      {
        url: "/splash/apple-splash-1242-2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 12/12 Pro, iPhone 13/13 Pro, iPhone 14
      {
        url: "/splash/apple-splash-1170-2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 12 Pro Max, iPhone 13 Pro Max, iPhone 14 Plus
      {
        url: "/splash/apple-splash-1284-2778.png",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 14 Pro
      {
        url: "/splash/apple-splash-1179-2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 14 Pro Max
      {
        url: "/splash/apple-splash-1290-2796.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPad
      {
        url: "/splash/apple-splash-768-1024.png",
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPad Pro 10.5"
      {
        url: "/splash/apple-splash-1112-1394.png",
        media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPad Pro 11"
      {
        url: "/splash/apple-splash-1194-1668.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPad Pro 12.9"
      {
        url: "/splash/apple-splash-2048-2732.png",
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalErrorBoundary>
          <Providers>
            <SkipLink />
            {children}
            <InstallPrompt />
          </Providers>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
