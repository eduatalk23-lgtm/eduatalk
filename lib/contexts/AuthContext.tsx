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

  // 인증 페이지 → 일반 페이지 전환 시 캐시 동기화
  // onAuthStateChange SIGNED_IN이 이미 refetch하므로, 캐시 누락 시에만 invalidate
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (isAuthPage) return;

    const isFromAuthPage = prevPathname && AUTH_PAGES.some((p) => prevPathname.startsWith(p));
    if (!isFromAuthPage) return;

    // getUser() 직접 호출 없이 캐시 존재 여부만 확인
    const cachedUser = queryClient.getQueryData(["auth", "me"]);
    if (!cachedUser) {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }
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
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith(chatKeys.prefix);
          },
        });
        queryClient.removeQueries({ queryKey: ["unread"] });
        // 채팅 operationTracker 전체 정리 (이전 사용자의 추적 상태 제거)
        operationTracker.clearAll();
      } else if (event === "SIGNED_IN") {
        // SSR에서 이미 prefetch된 데이터가 캐시에 있으면 중복 refetch 스킵
        // 초기 페이지 로드: Supabase SDK가 쿠키 세션 감지 → SIGNED_IN 발생 → 캐시 있음 → 스킵
        // 실제 로그인: /login에서 로그인 → 캐시 없음 → refetch (React Query가 중복 요청 자동 제거)
        // TOKEN_REFRESHED는 토큰만 갱신 (역할/프로필 불변) → 이 분기에 진입하지 않음
        const cachedUser = queryClient.getQueryData(["auth", "me"]);
        if (!cachedUser) {
          refetch();
        }
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

