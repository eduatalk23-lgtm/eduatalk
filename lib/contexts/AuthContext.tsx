"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from "@/lib/constants/queryCache";
import { isApiSuccess } from "@/lib/api";

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

      return result.data;
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
  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(authQueryOptions());

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

