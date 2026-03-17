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

// x-auth-* 헤더 이름 상수
const AUTH_HEADER = {
  USER_ID: "x-auth-user-id",
  ROLE: "x-auth-role",
  TENANT_ID: "x-auth-tenant-id",
  EMAIL: "x-auth-email",
} as const;

/** proxy.ts 내부에서 사용하는 유저 정보 타입 */
type ProxyUser = {
  id?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

/**
 * 인증된 유저 정보를 request 헤더에 주입
 * RSC/API Route에서 헤더를 읽어 getUser() 호출을 스킵할 수 있도록 함
 */
function injectAuthHeaders(
  request: NextRequest,
  user: ProxyUser | null,
): void {
  if (!user?.id) return;

  request.headers.set(AUTH_HEADER.USER_ID, user.id);

  const role = getRoleFromMetadata(user);
  if (role) {
    request.headers.set(AUTH_HEADER.ROLE, role);
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (tenantId) {
    request.headers.set(AUTH_HEADER.TENANT_ID, tenantId);
  }

  // email: JWT에서는 payload.email (top-level), Supabase User에서도 user.email
  const email = user.email;
  if (email) {
    request.headers.set(AUTH_HEADER.EMAIL, email);
  }
}

/**
 * deduplicatedGetUser 후 응답 재구성
 *
 * deduplicatedGetUser가 반환한 response에는 갱신된 쿠키가 포함되어 있지만,
 * 이후 주입한 x-auth-* 헤더는 포함되지 않음.
 * 새 response를 만들어 쿠키를 복사하고 최신 request.headers를 반영.
 */
function rebuildResponseWithAuthHeaders(
  request: NextRequest,
  oldResponse: NextResponse,
): NextResponse {
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const cookie of oldResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
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
  user: ProxyUser | null;
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

    // 청크 결합 → Supabase SSR v0.7+ 쿠키 포맷 처리
    // 포맷: "base64-{base64url인코딩된 세션JSON}"
    const combined = authCookies.map((c) => c.value).join("");
    let sessionStr: string;
    if (combined.startsWith("base64-")) {
      const b64url = combined.substring(7);
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
      sessionStr = atob(padded);
    } else {
      sessionStr = atob(combined);
    }
    const session = JSON.parse(sessionStr);

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
    const user: ProxyUser = {
      id: payload.sub as string,
      email: payload.email as string | undefined,
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

// ============================================
// getUser() promise deduplication
// 토큰 만료 60초 이내에 동시 요청이 들어오면
// 첫 번째 요청만 getUser()를 실행하고 나머지는 결과를 공유
// ============================================

let pendingRefresh: {
  promise: Promise<ProxyUser | null>;
  expiry: number;
} | null = null;

async function deduplicatedGetUser(
  request: NextRequest
): Promise<{
  user: ProxyUser | null;
  error: Error | null;
  getResponse: () => NextResponse;
}> {
  const now = Date.now();

  // 진행 중인 refresh가 있으면 결과만 공유 (response 쿠키는 이 요청에서 설정 불가)
  if (pendingRefresh && now < pendingRefresh.expiry) {
    const user = await pendingRefresh.promise;
    return {
      user,
      error: user ? null : new Error("Auth refresh failed"),
      getResponse: () => NextResponse.next({ request: { headers: request.headers } }),
    };
  }

  // 첫 번째 요청: getUser() 실행 + 쿠키 갱신
  const client = createSupabaseProxyClient(request);
  const userPromise = client.supabase.auth.getUser().then((result) => {
    const u = result.data.user;
    if (!u) return null;
    return { id: u.id, email: u.email, user_metadata: u.user_metadata } as ProxyUser;
  });

  pendingRefresh = { promise: userPromise, expiry: now + 5000 };
  userPromise.finally(() => {
    // 5초 후 자동 만료 (finally는 성공/실패 모두)
    setTimeout(() => {
      if (pendingRefresh?.promise === userPromise) {
        pendingRefresh = null;
      }
    }, 5000);
  });

  const user = await userPromise;
  return {
    user,
    error: user ? null : new Error("Auth failed"),
    getResponse: client.getResponse,
  };
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

    // 토큰 로컬 파싱으로 getUser() 네트워크 호출 최소화
    // - 토큰 유효(만료 60초 이상): 로컬 파싱만으로 통과 (0ms)
    // - 토큰 만료 임박/파싱 실패: getUser() 호출하여 리프레시 (네트워크)
    const apiParsed = parseTokenFromCookies(request);

    if (!apiParsed.needsRefresh && apiParsed.user) {
      // 토큰 유효 → 네트워크 호출 스킵 + 헤더 주입
      injectAuthHeaders(request, apiParsed.user);
      return NextResponse.next({ request: { headers: request.headers } });
    }

    // 토큰 만료 임박 또는 파싱 실패 → deduplicatedGetUser()로 리프레시
    const { user, error, getResponse } = await deduplicatedGetUser(request);

    if (error || !user) {
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

    // 리프레시 후 갱신된 유저 정보를 헤더에 주입
    injectAuthHeaders(request, user);
    return rebuildResponseWithAuthHeaders(request, getResponse());
  }

  // ─── 3. 페이지 경로 처리 ───
  const isPublicPath = isPublicPagePath(pathname);
  const isRSCRequest = request.headers.get("RSC") === "1";
  const isAuthPage = AUTH_ONLY_PAGES.some((path) => pathname.startsWith(path));

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

  let user: ProxyUser | null = null;
  let error: Error | null = null;
  let getResponse: () => NextResponse;

  if (parsed.needsRefresh && isAuthPage) {
    // Auth 페이지(로그인/회원가입)에서 만료된 토큰 → 갱신 스킵
    // getUser() 호출 시 stale refresh token 에러 + 쿠키 조작이 발생하여
    // Server Action(signIn)의 쿠키 설정과 충돌 → "unexpected response" 에러 유발
    // 만료된 세션 = 미인증이므로 로그인 페이지를 그대로 표시
    user = null;
    error = null;
    getResponse = () => NextResponse.next({ request: { headers: request.headers } });
  } else if (parsed.needsRefresh && !isRSCRequest) {
    // 토큰 리프레시 필요 + 풀 페이지 요청 → deduplicatedGetUser() (동시 요청 중복 방지)
    const result = await deduplicatedGetUser(request);
    user = result.user;
    error = result.error;
    getResponse = result.getResponse;
  } else if (parsed.needsRefresh && isRSCRequest && parsed.user) {
    // 토큰 만료 임박 + RSC prefetch → 리프레시 스킵 (브라우저 autoRefreshToken이 관리)
    user = parsed.user;
    error = null;
    getResponse = () => NextResponse.next({ request: { headers: request.headers } });
  } else if (parsed.needsRefresh) {
    // 토큰 파싱 자체 실패 (쿠키 없음 등) → deduplicatedGetUser()
    const result = await deduplicatedGetUser(request);
    user = result.user;
    error = result.error;
    getResponse = result.getResponse;
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

  // ─── 5. 인증된 유저 정보를 헤더에 주입 (RSC/API Route에서 getUser() 스킵) ───
  if (isAuthenticated && user) {
    injectAuthHeaders(request, user);
    // deduplicatedGetUser를 거친 경우 response에 쿠키가 있으므로 재구성 필요
    return rebuildResponseWithAuthHeaders(request, getResponse());
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
