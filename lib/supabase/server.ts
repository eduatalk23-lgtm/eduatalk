import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

type ReadonlyRequestCookies = Awaited<ReturnType<typeof cookies>>;

/**
 * Rate limit을 고려한 fetch wrapper
 *
 * 이전 구현은 내부 5초 sleep + retryWithBackoff 이중 대기로
 * 단일 429에 최대 21초 지연이 발생했음 (5+2+5+4+5).
 * 개선: 1회 빠른 재시도 (500ms) 후 즉시 실패. 호출자가 재시도 결정.
 */
async function rateLimitedFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    const response = await fetch(...args);

    if (response.status === 429) {
      if (attempt < 1) {
        // 1회만 짧게 재시도 (500ms + jitter)
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 200));
        continue;
      }
      // 재시도 소진 → 즉시 에러 throw (호출자가 처리)
      const error = new Error("Rate limit reached");
      (error as Error & { status?: number }).status = 429;
      throw error;
    }

    return response;
  }

  // unreachable
  throw new Error("Rate limit reached");
}

/**
 * 요청 내 캐싱된 Supabase Server Client
 *
 * GoTrueClient가 생성 시 _initialize() → _recoverAndRefresh() → _getUser()를
 * 호출하여 Supabase Auth에 네트워크 요청을 보냅니다.
 * React.cache()로 요청 내 1번만 생성하여 불필요한 auth 호출을 제거합니다.
 */
const getCachedServerClient = cache(
  () => createServerClientInternal()
);

/**
 * Supabase Server Client 생성
 *
 * 기본 호출(인자 없음): React.cache()로 요청 내 1번만 생성 (auth 호출 1회로 제한)
 * cookieStore/options 전달 시: 새 클라이언트 생성 (로그인 등 특수 케이스)
 */
export async function createSupabaseServerClient(
  cookieStore?: ReadonlyRequestCookies,
  options?: { rememberMe?: boolean }
) {
  // 기본 호출: 캐싱된 클라이언트 반환 (요청 내 GoTrueClient 1번만 생성)
  if (!cookieStore && !options) {
    return getCachedServerClient();
  }
  // 커스텀 호출: 별도 클라이언트 생성 (로그인 rememberMe 등)
  return createServerClientInternal(cookieStore, options);
}

/**
 * 실제 Supabase Server Client 생성 (내부용)
 */
async function createServerClientInternal(
  cookieStore?: ReadonlyRequestCookies,
  options?: { rememberMe?: boolean }
) {
  try {
    const store = cookieStore ?? (await cookies());
    const rememberMe = options?.rememberMe ?? false;

    // 환경 변수 검증 강화
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // 개발 환경에서는 즉시 에러 throw
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Supabase 환경 변수가 설정되지 않았습니다. ` +
            `NEXT_PUBLIC_SUPABASE_URL: ${!!env.NEXT_PUBLIC_SUPABASE_URL}, ` +
            `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${!!env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        );
      }
      // 프로덕션 환경에서는 경고 로그 후 계속 진행 (기존 동작 유지)
      console.error("[supabase/server] 환경 변수가 설정되지 않았습니다", {
        hasUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });
    }

    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL || "",
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        auth: {
          autoRefreshToken: false, // 자동 토큰 갱신 비활성화 (서버에서는 불필요)
          persistSession: false, // 서버에서는 세션을 쿠키에 저장하지 않음
        },
        global: {
          fetch: rateLimitedFetch, // Rate limit 처리된 fetch 사용
        },
        cookies: {
          getAll() {
            return store.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // Supabase 인증 관련 쿠키인 경우 자동로그인 옵션 적용
                const isAuthCookie =
                  name.includes("auth-token") ||
                  name.includes("auth-token-code-verifier");

                const finalOptions =
                  rememberMe && isAuthCookie
                    ? {
                        ...options,
                        maxAge: 60 * 60 * 24 * 30, // 30일
                        expires: new Date(
                          Date.now() + 60 * 60 * 24 * 30 * 1000
                        ),
                      }
                    : options;

                if (rememberMe && isAuthCookie) {
                  console.log("[auth] 자동로그인 쿠키 설정:", {
                    cookieName: name,
                    maxAge: finalOptions.maxAge,
                    expires: finalOptions.expires,
                  });
                }

                store.set(name, value, finalOptions);
              });
            } catch {
              // Server Component에서는 쿠키를 수정할 수 없으므로 조용히 무시
            }
          },
        },
      }
    );

    // proxy.ts가 auth 게이트웨이 역할을 하므로 서버 클라이언트에서 getUser()를 호출하지 않음.
    // getUser() 미호출 시 SDK 내부 suppressGetSessionWarning 플래그가 설정되지 않아
    // 데이터 쿼리에서 getSession() 경고가 발생하므로 수동 억제.
    const auth = client.auth as unknown as { suppressGetSessionWarning: boolean };
    auth.suppressGetSessionWarning = true;

    return client;
  } catch (error) {
    // 에러 메시지 추출
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Next.js 16 빌드 타임 정적 생성 중 에러 감지
    // 정적 생성 중에는 쿠키가 없으므로 cookies() 호출 시 "Dynamic server usage" 에러 발생
    // 이는 예상된 동작이므로 조용히 처리하고 public 클라이언트 반환
    const isStaticGenerationError =
      errorMessage.includes("Dynamic server usage") ||
      errorMessage.includes("couldn't be rendered statically");

    if (isStaticGenerationError) {
      // 정적 생성 중 에러는 로깅 없이 public 클라이언트 반환
      // 정적 생성 중에는 쿠키가 필요 없으므로 public 클라이언트가 적절함
      return createSupabasePublicClient();
    }

    // 런타임 에러는 상세 로깅하여 디버깅 가능하게 유지
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : undefined;

    console.error("[supabase/server] 클라이언트 생성 실패", {
      message: errorMessage,
      name: errorName,
      stack: errorStack,
      errorType: error?.constructor?.name,
      errorString: String(error),
    });

    // 에러가 발생해도 기본 클라이언트를 반환 (사용 시 에러 발생 가능)
    // 이렇게 하면 서버 컴포넌트 렌더링이 중단되지 않음
    try {
      return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL || "",
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          auth: {
            autoRefreshToken: false, // 자동 토큰 갱신 비활성화 (서버에서는 불필요)
            persistSession: false, // 서버에서는 세션을 쿠키에 저장하지 않음
          },
          cookies: {
            getAll() {
              return [];
            },
            setAll() {},
          },
        }
      );
    } catch (fallbackError) {
      // fallback 클라이언트 생성도 실패한 경우
      console.error(
        "[supabase/server] Fallback 클라이언트 생성도 실패",
        fallbackError
      );
      // 최후의 수단: 빈 URL과 키로 클라이언트 생성 (사용 시 에러 발생)
      return createServerClient("", "", {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      });
    }
  }
}

/**
 * 공개 데이터용 Supabase 클라이언트 생성 (쿠키 불필요)
 * unstable_cache 내부에서 사용 가능
 */
export function createSupabasePublicClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        fetch: (...args) => fetch(...args),
      },
    }
  );
}

/**
 * Admin 권한을 가진 Supabase 클라이언트 생성 (Service Role Key 사용)
 * 주의: 서버 사이드에서만 사용해야 하며, 절대 클라이언트에 노출되면 안 됨
 *
 * @returns Supabase Admin 클라이언트 또는 null (Service Role Key가 없을 경우)
 *
 * @deprecated lib/supabase/admin.ts의 createSupabaseAdminClient를 사용하세요.
 * 이 함수는 하위 호환성을 위해 유지되며, 내부적으로 admin.ts를 사용합니다.
 */
export function createSupabaseAdminClient() {
  // lib/supabase/admin.ts의 구현을 따름 (보안상 안전)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // 개발 환경에서는 에러 throw
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. " +
          "Admin 클라이언트를 생성할 수 없습니다."
      );
    }
    // 프로덕션 환경에서는 null 반환 (호출하는 쪽에서 처리)
    console.error(
      "[supabase/server] SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
    );
    return null;
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });
}
