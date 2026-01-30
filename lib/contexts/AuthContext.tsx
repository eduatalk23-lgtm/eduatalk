"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from "@/lib/constants/queryCache";
import { isApiSuccess } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

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
  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(authQueryOptions());

  // 경로 변경 시 Supabase 세션과 React Query 캐시 동기화
  // Server Action redirect 후 soft navigation에서 캐시가 stale 상태일 수 있음
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const cachedUser = queryClient.getQueryData(["auth", "me"]);

      // 세션이 있는데 캐시가 없거나 null이면 refetch
      if (session?.user && !cachedUser) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
      // 세션이 없는데 캐시가 있으면 캐시 클리어
      else if (!session?.user && cachedUser) {
        queryClient.setQueryData(["auth", "me"], null);
      }
    });
  }, [pathname, queryClient]);

  // Supabase auth state 변경 리스너 (로그인/로그아웃/토큰 갱신)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // 로그아웃 시 auth 캐시 즉시 무효화
        queryClient.setQueryData(["auth", "me"], null);
        queryClient.removeQueries({ queryKey: ["auth", "me"], exact: true });
        // 관련 사용자 데이터 쿼리도 무효화
        queryClient.invalidateQueries({ queryKey: ["chat"] });
        queryClient.invalidateQueries({ queryKey: ["unread"] });
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

