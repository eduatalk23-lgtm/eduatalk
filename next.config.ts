import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// 번들 분석기 설정
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Vercel Hobby 8GB 환경에서 TypeScript 체크 OOM 방지
  // 타입 체크는 로컬 pnpm build 또는 CI에서 별도 실행
  typescript: {
    ignoreBuildErrors: true,
  },
  // 보안 헤더 + SW 캐시 무효화
  async headers() {
    // PbD Phase 1: 기능 영향 없는 보안 헤더 (CSP는 외부 도메인 검증 필요해 별도 단계로 분리)
    const securityHeaders = [
      // HTTPS 강제 (Vercel은 이미 HTTPS이므로 안전). 1년 + 서브도메인 + preload
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      // 클릭재킹 방지 (iframe 임베딩 차단)
      { key: "X-Frame-Options", value: "DENY" },
      // MIME 스니핑 방지
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Referrer 정보 최소화 (origin만)
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // 불필요한 브라우저 권한 차단 (카메라/마이크/위치)
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },

  // @dnd-kit과 React 19 Concurrent Mode 호환성 문제로 비활성화
  // 드래그 중 컴포넌트가 반복적으로 마운트/언마운트되는 문제 방지
  reactStrictMode: false,


  // 컴파일러 최적화 설정
  compiler: {
    // 프로덕션 빌드에서 console.log 제거 (console.error는 유지)
    removeConsole: process.env.NODE_ENV === "production" 
      ? { exclude: ["error", "warn"] } 
      : false,
  },

  // 이미지 최적화 설정
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
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
      {
        protocol: "http",
        hostname: "img.megastudy.net",
      },
      {
        protocol: "https",
        hostname: "mall.chunjaetext.co.kr",
      },
      {
        protocol: "https",
        hostname: "www.mirae-n.com",
      },
      {
        protocol: "https",
        hostname: "e.vivasam.com",
      },
      {
        protocol: "https",
        hostname: "image.aladin.co.kr",
      },
      // Supabase Storage (채팅 첨부파일, 프로필 이미지 등)
      {
        protocol: "https",
        hostname: "yiswawnxsrdmvvihhpne.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // 압축 설정
  compress: true,

  // 실험적 기능
  experimental: {
    // 생기부 PDF Import — base64 이미지 전송을 위해 제한 확대
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // 패키지 임포트 최적화 - 트리 쉐이킹 및 번들 크기 감소
    optimizePackageImports: [
      // 아이콘
      "lucide-react",
      // 차트
      "recharts",
      // Supabase
      "@supabase/supabase-js",
      // 드래그 앤 드롭
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      // 폼 관리
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      // 날짜 처리
      "date-fns",
      // 애니메이션
      "framer-motion",
      // 유틸리티
      "clsx",
      "tailwind-merge",
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

// Bundle Analyzer + Sentry 적용
export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // 빌드 로그 억제 (CI에서만 표시)
  silent: !process.env.CI,
  // Vercel 배포 시 자동 릴리즈 생성
  webpack: {
    automaticVercelMonitors: true,
  },
  // 소스맵 설정
  sourcemaps: {
    // 클라이언트 번들에서 소스맵 삭제 (보안)
    deleteSourcemapsAfterUpload: true,
  },
  // 토큰 없으면 텔레메트리만 (빌드 실패 방지)
  telemetry: false,
});
