/**
 * 라우트 상수 정의
 *
 * proxy.ts와 robots.ts, sitemap.ts에서 공유하는 경로 분류.
 * 새 라우트 추가 시 여기에 반영하면 프록시, robots.txt, sitemap에 자동 적용됩니다.
 */

/** 사이트 기본 URL (SEO, sitemap, canonical 등에 사용) */
export const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://timelevelup.com";

/** 인증 없이 접근 가능한 페이지 경로 */
export const PUBLIC_PAGE_PATHS = [
  "/login",
  "/signup",
  "/join",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/onboarding",
  "/student-setup",
  "/offline",
] as const;

/**
 * 인증된 사용자가 접근하면 안 되는 경로
 * (로그인/회원가입 등 — 인증 시 대시보드로 리다이렉트)
 */
export const AUTH_ONLY_PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

/** 인증 없이 접근 가능한 API 경로 (prefix match) */
export const PUBLIC_API_PATHS = [
  "/api/terms",
  "/api/schools/search",
  "/api/platforms",
  "/api/subjects",
  "/api/subject-groups",
  "/api/curriculum-revisions",
  "/api/difficulty-levels",
  "/api/goals/list",
  "/api/push/click", // SW notificationclick에서 인증 없이 호출 (UUID 기반)
] as const;

/** 외부 서비스 웹훅 경로 (자체 인증 메커니즘 사용) */
export const WEBHOOK_PATHS = [
  "/api/webhooks/google-calendar",
  "/api/payments/toss/webhook",
] as const;

/** Cron 경로 (CRON_SECRET으로 보호, 프록시 바이패스) */
export const CRON_PATHS = ["/api/cron"] as const;

/**
 * 역할별 허용 경로 패턴
 * 각 역할이 접근할 수 있는 경로의 prefix를 정의
 */
export const ROLE_ALLOWED_PATHS: Record<string, readonly string[]> = {
  student: [
    "/dashboard",
    "/today",
    "/plan",
    "/scores",
    "/analysis",
    "/blocks",
    "/contents",
    "/chat",
    "/attendance",
    "/habits",
    "/settings",
    "/camp",
    "/files",
    "/report",
    "/reports",
  ],
  admin: ["/admin"],
  consultant: ["/admin"],
  parent: ["/parent"],
  superadmin: ["/superadmin", "/admin"],
} as const;

/** 역할별 기본 대시보드 경로 */
export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  consultant: "/admin/dashboard",
  parent: "/parent/dashboard",
  student: "/dashboard",
};

/** 크롤러가 접근하면 안 되는 경로 (robots.txt용) */
export const CRAWLER_DISALLOW_PATHS = [
  "/api/",
  "/admin/",
  "/parent/",
  "/superadmin/",
  "/dashboard",
  "/today",
  "/plan",
  "/scores",
  "/analysis",
  "/blocks",
  "/contents",
  "/chat",
  "/attendance",
  "/habits",
  "/settings",
  "/camp",
  "/files",
  "/report",
  "/reports",
  "/auth/callback",
  "/onboarding",
  "/student-setup",
  "/reset-password",
  "/forgot-password",
  "/offline",
] as const;

/** 크롤러가 접근 가능한 경로 (robots.txt용) */
export const CRAWLER_ALLOW_PATHS = [
  "/login",
  "/signup",
  "/join/",
] as const;
