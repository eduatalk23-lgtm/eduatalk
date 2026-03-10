"use client";

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from "@/lib/constants/queryCache";
import { isApiSuccess } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { chatKeys } from "@/lib/domains/chat/queryKeys";

// 인증 관련 페이지 경로 (로그인/가입 후 리다이렉트 소스)
const AUTH_PAGES = ["/login", "/signup", "/auth/callback", "/onboarding"];

/**
 * 사용자 정보 조회 쿼리 옵션
 */
function authQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "me"] as const,
    queryFn: async (): Promise<CurrentUser | null> => {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!response.ok) {
        // 401 Unauthorized는 로그인하지 않은 상태이므로 null 반환
        if (response.status === 401) {
          return null;
        }
        throw new Error("사용자 정보를 불러오는데 실패했습니다.");
      }

      const result = await response.json();

      if (!isApiSuccess(result)) {
        // 에러 응답인 경우 null 반환 (로그인하지 않은 상태로 간주)
        return null;
      }

      return result.data as CurrentUser | null;
    },
    staleTime: CACHE_STALE_TIME_STABLE, // 5분
    gcTime: CACHE_GC_TIME_STABLE, // 15분
    retry: 1,
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 리페치 비활성화
    refetchOnReconnect: true, // 네트워크 재연결 시 자동 리페치
  });
}

/**
 * AuthContext의 값 타입
 */
interface AuthContextValue {
  /**
   * 현재 로그인한 사용자 정보
   */
  user: CurrentUser | null;

  /**
   * 데이터 로딩 중 여부
   */
  isLoading: boolean;

  /**
   * 에러 발생 여부
   */
  isError: boolean;

  /**
   * 에러 객체
   */
  error: Error | null;

  /**
   * 사용자 정보 수동 리페치
   */
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthContext Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthContext Provider
 *
 * 클라이언트 사이드에서 사용자 정보를 한 번만 로드하고 재사용하기 위한 Context입니다.
 * React Query를 통해 자동 캐싱 및 갱신을 처리합니다.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    ...authQueryOptions(),
    enabled: !isAuthPage,
  });

  // 인증 페이지 → 일반 페이지 전환 시에만 Supabase 세션-캐시 동기화
  // 일반 경로 변경 시에는 onAuthStateChange가 세션 변경을 감지하므로 getUser() 불필요
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    // 인증 페이지에서는 세션 동기화 불필요
    if (isAuthPage) return;

    // 인증 페이지에서 다른 페이지로 이동한 경우에만 동기화 (로그인/가입 후)
    const isFromAuthPage = prevPathname && AUTH_PAGES.some((p) => prevPathname.startsWith(p));
    if (!isFromAuthPage) return;

    // 쿠키 동기화를 위해 지연 후 세션 확인
    const checkAndSync = (attempt: number = 1) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        const cachedUser = queryClient.getQueryData(["auth", "me"]);

        if (user && !cachedUser) {
          queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        } else if (!user && attempt < 3) {
          setTimeout(() => checkAndSync(attempt + 1), 100 * attempt);
        }
      });
    };
    checkAndSync();
  }, [pathname, queryClient, isAuthPage]);

  // Supabase auth state 변경 리스너 (로그인/로그아웃/토큰 갱신)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // 로그아웃 시 auth 캐시 즉시 무효화
        queryClient.setQueryData(["auth", "me"], null);
        queryClient.removeQueries({ queryKey: ["auth", "me"], exact: true });
        // 모든 채팅 관련 캐시 완전 제거 (사용자 전환 시 이전 데이터 노출 방지)
        // chat-rooms, chat-messages, chat-room, chat-pinned, chat-announcement,
        // chat-notification-prefs, chat-can-pin, chat-can-set-announcement, chat-room-members
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith(chatKeys.prefix);
          },
        });
        queryClient.removeQueries({ queryKey: ["unread"] });
        // 채팅 operationTracker 전체 정리 (이전 사용자의 추적 상태 제거)
        operationTracker.clearAll();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // 로그인 또는 토큰 갱신 시 사용자 정보 리페치
        refetch();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, refetch]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * AuthContext Hook
 *
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

