import type { NextConfig } from "next";
import withPWA from "next-pwa";

// 번들 분석기 설정
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

// PWA 설정
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // 개발 환경에서는 비활성화
  buildExcludes: [/app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400, // 24시간
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  // 이미지 최적화 설정
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 외부 이미지 도메인 허용 (cover_image_url 사용 시 필요)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "contents.kyobobook.co.kr",
      },
      {
        protocol: "https",
        hostname: "img.megastudy.net",
      },
      // 필요시 다른 도메인 추가 가능
      // {
      //   protocol: "https",
      //   hostname: "example.com",
      // },
    ],
  },

  // 압축 설정
  compress: true,

  // 실험적 기능
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
    ],
  },

  // Turbopack 설정 (Next.js 16 기본)
  turbopack: {
    resolveAlias: {
      // 서버 전용 패키지는 클라이언트에서 제외
    },
  },

  // 웹팩 최적화 (빌드 시 사용, Turbopack과 호환을 위해 조건부 적용)
  webpack: (config, { isServer, dev }) => {
    // 개발 환경에서 Turbopack 사용 시 webpack 설정 건너뛰기
    if (dev) {
      return config;
    }

    // 서버 사이드에서만 필요한 패키지 제외
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

// PWA와 Bundle Analyzer를 함께 적용
export default withBundleAnalyzer(pwaConfig(nextConfig));
