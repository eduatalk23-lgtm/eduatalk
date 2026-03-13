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
 * JWT user_metadata에서 역할을 추출 (DB 쿼리 없음)
 *
 * proxy는 인증(Authentication)만 담당하고, 세부 인가(Authorization)는 레이아웃에 위임합니다.
 * user_metadata.signup_role은 회원가입/초대 수락 시 설정되며,
 * 대략적인 경로 보호(coarse-grained routing)에만 사용됩니다.
 * 정확한 역할 검증(DB 기반)은 각 레이아웃의 getCachedUserRole()이 수행합니다.
 */
function getRoleFromMetadata(
  user: { user_metadata?: Record<string, unknown> } | null
): string | null {
  const signupRole = user?.user_metadata?.signup_role;
  if (
    signupRole === "student" ||
    signupRole === "parent" ||
    signupRole === "admin" ||
    signupRole === "consultant" ||
    signupRole === "superadmin"
  ) {
    return signupRole as string;
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
 * JWT 토큰이 만료 임박한지 확인 (Edge Runtime 호환)
 *
 * Supabase 쿠키에서 access_token의 exp를 로컬 파싱하여 확인.
 * 토큰이 아직 유효하면 getUser() 네트워크 호출을 스킵할 수 있음.
 * 만료 60초 전부터 리프레시 필요로 판단.
 *
 * @returns { needsRefresh, user } — needsRefresh=false이면 getUser() 스킵 가능
 */
function parseTokenFromCookies(request: NextRequest): {
  needsRefresh: boolean;
  user: { user_metadata?: Record<string, unknown> } | null;
} {
  try {
    // Supabase 쿠키는 청크 분할됨: sb-{ref}-auth-token.0, .1, ...
    const authCookies = request.cookies
      .getAll()
      .filter((c) => c.name.includes("auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (authCookies.length === 0) {
      return { needsRefresh: true, user: null };
    }

    // 청크 결합 → base64 디코딩 → JSON 파싱
    const combined = authCookies.map((c) => c.value).join("");
    const decoded = atob(combined);
    const session = JSON.parse(decoded);

    const accessToken = session?.access_token;
    if (!accessToken) {
      return { needsRefresh: true, user: null };
    }

    // JWT payload 디코딩 (서명 검증 없음 — proxy는 라우팅만 담당)
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) {
      return { needsRefresh: true, user: null };
    }

    const payload = JSON.parse(atob(payloadPart));
    const exp = payload.exp as number | undefined;
    if (!exp) {
      return { needsRefresh: true, user: null };
    }

    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = (exp - now) < 60; // 만료 60초 전부터 리프레시

    // user 정보 추출 (getUser() 호출 없이 라우팅에 사용)
    const user = {
      id: payload.sub as string,
      user_metadata: payload.user_metadata as Record<string, unknown> | undefined,
    };

    return { needsRefresh, user };
  } catch {
    // 파싱 실패 시 안전하게 getUser() 호출
    return { needsRefresh: true, user: null };
  }
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

  // 공개 경로 + 인증 쿠키 없음 → getUser() 호출 없이 즉시 반환
  if (isPublicPath && !hasAuthCookies(request)) {
    return NextResponse.next();
  }

  // 토큰 로컬 파싱으로 getUser() 네트워크 호출 최소화
  // - 토큰 유효(만료 60초 이상): 로컬 파싱만으로 라우팅 (0ms)
  // - 토큰 만료 임박/파싱 실패: getUser() 호출하여 리프레시 (네트워크)
  const parsed = hasAuthCookies(request)
    ? parseTokenFromCookies(request)
    : { needsRefresh: true, user: null };

  let user: { id?: string; user_metadata?: Record<string, unknown> } | null = null;
  let error: Error | null = null;
  let getResponse: () => NextResponse;

  if (parsed.needsRefresh) {
    // 토큰 리프레시 필요 → getUser() 네트워크 호출 (쿠키 갱신 포함)
    const client = createSupabaseProxyClient(request);
    const result = await client.supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
    getResponse = client.getResponse;
  } else {
    // 토큰 유효 → 네트워크 호출 스킵 (핵심 최적화)
    user = parsed.user;
    error = null;
    getResponse = () => NextResponse.next({ request: { headers: request.headers } });
  }

  // 인증 에러 처리 (refresh token 만료 등)
  if (error) {
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

  // ─── 4. 경량 경로 보호 (DB 쿼리 없음, user_metadata만 사용) ───
  // 세부 인가는 각 레이아웃의 getCachedUserRole()이 DB 기반으로 수행합니다.
  if (isAuthenticated && user && !isPublicPath) {
    // 초대 수락 직후 리다이렉트: 역할이 방금 부여되어 metadata 전파 지연 가능
    // join_accepted=true 파라미터로 1회 우회 허용
    const joinAccepted = request.nextUrl.searchParams.get("join_accepted") === "true";

    if (!joinAccepted) {
      const role = getRoleFromMetadata(user);

      // metadata에 역할이 있으면 → 경로 접근 제어 (대략적 보호)
      // metadata에 역할이 없으면 → 통과 (레이아웃의 DB 기반 getCachedUserRole()이 판단)
      //   - 기존 사용자: DB에 역할이 있으므로 레이아웃에서 정상 처리
      //   - 신규 사용자: 루트 페이지(/)의 역할 라우팅에서 onboarding으로 안내
      if (role && !canAccessPath(role, pathname)) {
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
