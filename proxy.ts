import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import {
  PUBLIC_PAGE_PATHS,
  PUBLIC_API_PATHS,
  WEBHOOK_PATHS,
  CRON_PATHS,
  AUTH_ONLY_PAGES,
  ROLE_ALLOWED_PATHS,
  ROLE_DASHBOARD_MAP,
} from "@/lib/constants/routes";

/**
 * 정적 파일 경로 (프록시 스킵)
 */
const STATIC_PATHS = [
  "/_next",
  "/icons",
  "/splash",
  "/manifest.json",
  "/favicon.ico",
  "/sw.js",
  "/workbox-",
];

/**
 * Supabase 클라이언트를 생성하고 response를 관리하는 헬퍼
 */
function createSupabaseProxyClient(request: NextRequest) {
  // response를 저장할 객체 (클로저 문제 방지)
  const responseHolder = {
    response: NextResponse.next({
      request: { headers: request.headers },
    }),
  };

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request cookies 업데이트
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // 새 response 생성
          responseHolder.response = NextResponse.next({
            request: { headers: request.headers },
          });
          // response cookies 설정
          cookiesToSet.forEach(({ name, value, options }) =>
            responseHolder.response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, getResponse: () => responseHolder.response };
}

/**
 * 사용자 역할을 조회하는 헬퍼 함수
 * 중복 DB 쿼리를 피하기 위해 proxy에서 가볍게 역할만 확인
 */
async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string | null> {
  // 3개 역할 테이블 병렬 조회
  const [adminResult, parentResult, studentResult] = await Promise.allSettled([
    supabase
      .from("admin_users")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("parent_users")
      .select("id")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  // 우선순위: admin > parent > student
  if (adminResult.status === "fulfilled" && adminResult.value.data?.role) {
    return adminResult.value.data.role;
  }

  if (parentResult.status === "fulfilled" && parentResult.value.data) {
    return "parent";
  }

  if (studentResult.status === "fulfilled" && studentResult.value.data) {
    return "student";
  }

  // 테이블에 없으면 user_metadata의 signup_role fallback
  // (초대 수락 직후 RLS 전파 지연 시 보호)
  const { data: { user } } = await supabase.auth.getUser();
  const signupRole = user?.user_metadata?.signup_role;
  if (signupRole === "student" || signupRole === "parent" || signupRole === "admin" || signupRole === "consultant") {
    return signupRole;
  }

  return null;
}

/**
 * 해당 역할이 주어진 경로에 접근 가능한지 확인
 */
function canAccessPath(role: string, pathname: string): boolean {
  const allowedPaths = ROLE_ALLOWED_PATHS[role];
  if (!allowedPaths) return false;

  // 루트 경로는 모든 인증된 사용자 허용
  if (pathname === "/") return true;

  return allowedPaths.some((path) => pathname.startsWith(path));
}

/**
 * 인증 쿠키 존재 여부 확인
 * Supabase auth 쿠키(sb-*-auth-token)가 있는지 빠르게 판별
 */
function hasAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.includes("auth-token"));
}

/**
 * 공개 페이지 경로인지 확인 (prefix match)
 */
function isPublicPagePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * 프록시를 건너뛰어야 하는 API 경로인지 확인
 * - 공개 API: 인증 불필요한 참조 데이터
 * - 웹훅: 외부 서비스 자체 인증 메커니즘 사용
 * - Cron: CRON_SECRET으로 자체 보호
 */
function isPublicApiPath(pathname: string): boolean {
  // 공개 API
  for (const path of PUBLIC_API_PATHS) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return true;
    }
  }
  // 웹훅
  for (const path of WEBHOOK_PATHS) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return true;
    }
  }
  // Cron
  for (const path of CRON_PATHS) {
    if (pathname.startsWith(`${path}/`)) {
      return true;
    }
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. 정적 파일은 즉시 스킵 ───
  if (STATIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // ─── 2. API 경로 처리 ───
  if (pathname.startsWith("/api/")) {
    // 공개 API, 웹훅, Cron은 바이패스
    if (isPublicApiPath(pathname)) {
      return NextResponse.next();
    }

    // 인증 쿠키 없으면 즉시 401 (getUser 호출 없이 빠른 차단)
    if (!hasAuthCookies(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 보호된 API: 세션 갱신 후 통과 (세부 권한은 각 핸들러에서 체크)
    const { supabase, getResponse } = createSupabaseProxyClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      // getResponse()의 쿠키를 401 응답에 포함 (토큰 갱신 쿠키 유실 방지)
      const res = getResponse();
      const jsonResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      res.cookies.getAll().forEach((cookie) => {
        jsonResponse.cookies.set(cookie.name, cookie.value);
      });
      return jsonResponse;
    }

    return getResponse();
  }

  // ─── 3. 페이지 경로 처리 ───
  const isPublicPath = isPublicPagePath(pathname);

  // 공개 경로 + 인증 쿠키 없음 → getUser() 호출 없이 즉시 반환 (핵심 최적화)
  if (isPublicPath && !hasAuthCookies(request)) {
    return NextResponse.next();
  }

  // Supabase 클라이언트 생성
  const { supabase, getResponse } = createSupabaseProxyClient(request);

  // 세션 확인 (getUser는 서버에서 검증하므로 더 안전)
  // 중요: getSession() 대신 getUser()를 사용해야 토큰이 실제로 검증됨
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 인증 에러 처리 (refresh token 만료 등)
  if (error) {
    // 세션 관련 에러 시 공개 경로가 아니면 로그인으로
    if (!isPublicPath) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("returnUrl", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAuthenticated = !!user;
  const isAuthPage = AUTH_ONLY_PAGES.some((path) => pathname.startsWith(path));

  // 비밀번호 재설정 페이지는 특별 처리
  if (pathname.startsWith("/reset-password")) {
    if (isAuthenticated) {
      return getResponse();
    }
    return NextResponse.redirect(new URL("/forgot-password", request.url));
  }

  // 인증되지 않은 사용자가 보호된 경로 접근 시 → 로그인으로
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 인증된 사용자가 로그인/회원가입 페이지 접근 시 → 대시보드로
  if (isAuthenticated && isAuthPage) {
    const returnUrl = request.nextUrl.searchParams.get("returnUrl");
    // 오픈 리다이렉트 방지: 상대 경로만 허용 (//evil.com, /\evil.com 차단)
    if (returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") && !returnUrl.startsWith("/\\")) {
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 인증된 사용자의 역할 기반 접근 제어
  if (isAuthenticated && user && !isPublicPath) {
    // 초대 수락 직후 리다이렉트: 역할이 방금 부여되어 RLS 전파 지연 가능
    // join_accepted=true 파라미터로 1회 우회 허용
    const joinAccepted = request.nextUrl.searchParams.get("join_accepted") === "true";

    if (!joinAccepted) {
      const role = await getUserRole(supabase, user.id);

      // 역할이 없는 사용자는 역할 선택 페이지로 리다이렉트
      if (!role) {
        return NextResponse.redirect(new URL("/onboarding/select-role", request.url));
      }

      // 현재 경로에 접근 권한이 없는 경우
      if (!canAccessPath(role, pathname)) {
        const defaultDashboard = ROLE_DASHBOARD_MAP[role] || "/";
        return NextResponse.redirect(new URL(defaultDashboard, request.url));
      }
    }
  }

  return getResponse();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
};
