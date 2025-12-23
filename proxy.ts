import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * 인증이 필요 없는 공개 경로
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/signup/verify-email",
];

/**
 * 정적 파일 및 API 경로 (프록시 스킵)
 */
const SKIP_PATHS = [
  "/_next",
  "/api",
  "/icons",
  "/splash",
  "/manifest.json",
  "/favicon.ico",
  "/sw.js",
  "/workbox-",
];

/**
 * 인증된 사용자가 접근하면 안 되는 경로 (로그인/회원가입 등)
 */
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * 역할별 허용 경로 패턴
 * 각 역할이 접근할 수 있는 경로의 prefix를 정의
 */
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  student: ["/dashboard", "/today", "/plan", "/scores", "/contents", "/blocks", "/settings", "/report", "/reports", "/analysis", "/camp", "/attendance"],
  admin: ["/admin"],
  consultant: ["/admin"],
  parent: ["/parent"],
  superadmin: ["/superadmin", "/admin"],
};

/**
 * 역할별 기본 대시보드 경로
 */
const ROLE_DEFAULT_DASHBOARD: Record<string, string> = {
  student: "/dashboard",
  admin: "/admin/dashboard",
  consultant: "/admin/dashboard",
  parent: "/parent/dashboard",
  superadmin: "/superadmin/dashboard",
};

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
  // 1. admin_users 확인 (admin, consultant, superadmin)
  const { data: admin } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (admin?.role) {
    return admin.role;
  }

  // 2. parent_users 확인
  const { data: parent } = await supabase
    .from("parent_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (parent) {
    return "parent";
  }

  // 3. students 확인
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (student) {
    return "student";
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 및 API 경로는 스킵
  if (SKIP_PATHS.some((path) => pathname.startsWith(path))) {
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
    const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
    if (!isPublicPath) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("returnUrl", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAuthenticated = !!user;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));

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
    if (returnUrl) {
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 인증된 사용자의 역할 기반 접근 제어
  if (isAuthenticated && user && !isPublicPath) {
    const role = await getUserRole(supabase, user.id);

    // 역할이 없는 사용자는 일단 통과 (layout에서 처리)
    if (!role) {
      return getResponse();
    }

    // 현재 경로에 접근 권한이 없는 경우
    if (!canAccessPath(role, pathname)) {
      const defaultDashboard = ROLE_DEFAULT_DASHBOARD[role] || "/";
      return NextResponse.redirect(new URL(defaultDashboard, request.url));
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
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};



