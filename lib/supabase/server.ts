import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { isRateLimitError, retryWithBackoff } from "@/lib/auth/rateLimitHandler";

type ReadonlyRequestCookies = Awaited<ReturnType<typeof cookies>>;

/**
 * Rate limit을 고려한 fetch wrapper
 */
async function rateLimitedFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(...args);
      
      // Rate limit 응답 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        throw new Error("Rate limit reached");
      }
      
      return response;
    },
    2, // 최대 2번 재시도
    2000, // 초기 2초 대기
    false // 일반 fetch 요청
  );
}

/**
 * Supabase Server Client 생성
 * 
 * Next.js 15에서는 쿠키 수정이 Server Action이나 Route Handler에서만 가능합니다.
 * 일반 Server Component에서는 쿠키를 읽기 전용으로만 사용합니다.
 */
export async function createSupabaseServerClient(
  cookieStore?: ReadonlyRequestCookies,
  options?: { rememberMe?: boolean }
) {
  try {
    const store = cookieStore ?? await cookies();
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

    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL || "",
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
      auth: {
        autoRefreshToken: false, // 자동 토큰 갱신 비활성화 (서버에서는 불필요)
        persistSession: false,   // 서버에서는 세션을 쿠키에 저장하지 않음
      },
      global: {
        fetch: rateLimitedFetch, // Rate limit 처리된 fetch 사용
      },
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, cookieOptions: CookieOptions) {
          // Next.js 15에서는 Server Component에서 쿠키를 수정할 수 없습니다.
          // 쿠키 설정은 Server Action이나 Route Handler에서만 가능합니다.
          // 인증 토큰 갱신은 클라이언트 사이드에서 처리되므로, 
          // Server Component에서는 쿠키 설정을 건너뜁니다.
          try {
            // Supabase 인증 관련 쿠키인 경우 자동로그인 옵션 적용
            // Supabase는 보통 'sb-*-auth-token' 형식의 쿠키를 사용합니다
            const isAuthCookie = name.includes('auth-token') || name.includes('auth-token-code-verifier');
            
            // 자동로그인 옵션이 있고 인증 쿠키인 경우 쿠키 만료 시간을 길게 설정 (30일)
            const finalCookieOptions = rememberMe && isAuthCookie
              ? {
                  ...cookieOptions,
                  maxAge: 60 * 60 * 24 * 30, // 30일 (초 단위)
                  expires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30일 후
                }
              : cookieOptions;
            
            // 디버깅: 자동로그인 쿠키 설정 로그
            if (rememberMe && isAuthCookie) {
              console.log("[auth] 자동로그인 쿠키 설정:", {
                cookieName: name,
                maxAge: finalCookieOptions.maxAge,
                expires: finalCookieOptions.expires,
              });
            }
            
            // 쿠키 설정 시도 (Server Action이나 Route Handler에서만 성공)
            store.set(name, value, finalCookieOptions);
          } catch (error) {
            // Server Component에서는 쿠키를 수정할 수 없으므로 조용히 무시
            // 이는 정상적인 동작이며, 인증 토큰 갱신은 클라이언트에서 처리됩니다
            // 에러를 무시하여 unhandled rejection을 방지합니다
          }
        },
        remove(name: string, options: CookieOptions) {
          // Next.js 15에서는 Server Component에서 쿠키를 수정할 수 없습니다.
          try {
            store.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {
            // Server Component에서는 쿠키를 수정할 수 없으므로 조용히 무시
            // 에러를 무시하여 unhandled rejection을 방지합니다
          }
        },
      },
    }
    );
  } catch (error) {
    // Supabase 클라이언트 생성 실패 시 에러 로깅
    const errorMessage = error instanceof Error ? error.message : String(error);
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
            persistSession: false,   // 서버에서는 세션을 쿠키에 저장하지 않음
          },
          cookies: {
            get() { return undefined; },
            set() {},
            remove() {},
          },
        }
      );
    } catch (fallbackError) {
      // fallback 클라이언트 생성도 실패한 경우
      console.error("[supabase/server] Fallback 클라이언트 생성도 실패", fallbackError);
      // 최후의 수단: 빈 URL과 키로 클라이언트 생성 (사용 시 에러 발생)
      return createServerClient("", "", {
        auth: {
          autoRefreshToken: false, // 자동 토큰 갱신 비활성화 (서버에서는 불필요)
          persistSession: false,   // 서버에서는 세션을 쿠키에 저장하지 않음
        },
        cookies: {
          get() { return undefined; },
          set() {},
          remove() {},
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
