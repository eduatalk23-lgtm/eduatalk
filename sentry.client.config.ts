import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // production에서만 에러 수집
  enabled: process.env.NODE_ENV === "production",

  // 샘플링: 에러 100%, 성능 10%
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // 디버그 (개발 시 true로 변경)
  debug: false,

  // 무시할 에러 패턴
  ignoreErrors: [
    // 브라우저 확장 프로그램 에러
    "ResizeObserver loop",
    "Non-Error promise rejection",
    // 네트워크 에러 (사용자 환경 문제)
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // Next.js 라우팅
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  beforeSend(event) {
    // 개발 환경 차단 (이중 안전장치)
    if (process.env.NODE_ENV !== "production") return null;
    return event;
  },
});
