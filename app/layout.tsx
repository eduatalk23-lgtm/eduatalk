import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_KR } from "next/font/google";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import "./globals.css";
import { Providers } from "./providers";
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from "@/lib/constants/queryCache";
import { SkipLink } from "@/components/layout/SkipLink";
import { RouteAnnouncer } from "@/components/layout/RouteAnnouncer";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";
import { SplashDismisser } from "@/components/pwa/SplashDismisser";
import { DeferredWidgets } from "@/components/layout/DeferredWidgets";
import NextTopLoader from "nextjs-toploader";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  preload: false,
});

const notoSerif = Noto_Serif_KR({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false, // 리포트 전용이므로 lazy
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
      // --- 라이트 모드 ---
      // iPhone SE/8/7/6s/6
      {
        url: "/splash/apple-splash-750-1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPhone 8 Plus/7 Plus/6s Plus
      {
        url: "/splash/apple-splash-1242-2208.png",
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone X/XS/11 Pro/12 mini/13 mini
      {
        url: "/splash/apple-splash-1125-2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone XR/11
      {
        url: "/splash/apple-splash-828-1792.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPhone XS Max/11 Pro Max
      {
        url: "/splash/apple-splash-1242-2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 12/13/14
      {
        url: "/splash/apple-splash-1170-2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 12/13 Pro Max/14 Plus
      {
        url: "/splash/apple-splash-1284-2778.png",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 14 Pro
      {
        url: "/splash/apple-splash-1179-2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPhone 14 Pro Max
      {
        url: "/splash/apple-splash-1290-2796.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)",
      },
      // iPad
      {
        url: "/splash/apple-splash-768-1024.png",
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad Pro 10.5"
      {
        url: "/splash/apple-splash-1112-1394.png",
        media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad Pro 11"
      {
        url: "/splash/apple-splash-1194-1668.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // iPad Pro 12.9"
      {
        url: "/splash/apple-splash-2048-2732.png",
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: light)",
      },
      // --- 다크 모드 ---
      // iPhone SE/8/7/6s/6
      {
        url: "/splash/apple-splash-dark-750-1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      // iPhone 8 Plus/7 Plus/6s Plus
      {
        url: "/splash/apple-splash-dark-1242-2208.png",
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone X/XS/11 Pro/12 mini/13 mini
      {
        url: "/splash/apple-splash-dark-1125-2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone XR/11
      {
        url: "/splash/apple-splash-dark-828-1792.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      // iPhone XS Max/11 Pro Max
      {
        url: "/splash/apple-splash-dark-1242-2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone 12/13/14
      {
        url: "/splash/apple-splash-dark-1170-2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone 12/13 Pro Max/14 Plus
      {
        url: "/splash/apple-splash-dark-1284-2778.png",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone 14 Pro
      {
        url: "/splash/apple-splash-dark-1179-2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPhone 14 Pro Max
      {
        url: "/splash/apple-splash-dark-1290-2796.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)",
      },
      // iPad
      {
        url: "/splash/apple-splash-dark-768-1024.png",
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      // iPad Pro 10.5"
      {
        url: "/splash/apple-splash-dark-1112-1394.png",
        media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      // iPad Pro 11"
      {
        url: "/splash/apple-splash-dark-1194-1668.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
      },
      // iPad Pro 12.9"
      {
        url: "/splash/apple-splash-dark-2048-2732.png",
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (prefers-color-scheme: dark)",
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
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy 단일 인증제: proxy.ts가 JWT 검증/리프레시를 완료했으므로
  // Root Layout에서 auth prefetch를 블로킹하지 않음.
  // 클라이언트 AuthContext가 /api/auth/me로 lazy fetch 처리.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_STALE_TIME_STABLE,
        gcTime: CACHE_GC_TIME_STABLE,
      },
    },
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <html lang="ko" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* 스플래시 로고 preload — HTML 파싱 즉시 다운로드 시작 */}
        <link rel="preload" href="/splash/eduatalk.png" as="image" />
        {/* 다크모드 FOUC 방지 — hydration 전 즉시 .dark 클래스 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches))d.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} antialiased`}
      >
        {/* 인라인 스플래시: JS 번들 로딩 전 즉시 렌더링되어 White Flash 방지 */}
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: `
          #pwa-splash {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
            background-color: #ffffff;
            transition: opacity 0.3s ease-out;
          }
          #pwa-splash img {
            width: 120px; height: 120px; object-fit: contain;
            animation: splash-fade-in 0.4s ease-out both;
          }
          #pwa-splash .splash-title {
            font-family: var(--font-geist-sans), -apple-system, sans-serif;
            font-size: 18px; font-weight: 600; letter-spacing: -0.02em;
            color: #171717;
            animation: splash-fade-in 0.4s 0.1s ease-out both;
          }
          @keyframes splash-fade-in {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
          }
          @media (prefers-color-scheme: dark) {
            #pwa-splash { background-color: #0a0a0a; }
            #pwa-splash .splash-title { color: #ededed; }
          }
          .dark #pwa-splash { background-color: #0a0a0a; }
          .dark #pwa-splash .splash-title { color: #ededed; }
          @media not all and (display-mode: standalone) {
            #pwa-splash { display: none !important; }
          }
        `}} />
        <div id="pwa-splash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/splash/eduatalk.png" alt="" width={120} height={120} />
          <span className="splash-title">TimeLevelUp</span>
        </div>
        <NextTopLoader color="rgb(var(--color-primary-600))" height={3} showSpinner={false} shadow={false} />
        <GlobalErrorBoundary>
          <Providers dehydratedState={dehydratedState}>
            <SplashDismisser />
            <SkipLink />
            <RouteAnnouncer />
            {children}
            <DeferredWidgets />
          </Providers>
        </GlobalErrorBoundary>
        <SpeedInsights />
      </body>
    </html>
  );
}
