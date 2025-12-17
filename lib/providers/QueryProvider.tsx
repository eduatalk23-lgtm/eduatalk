"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";

// 개발 환경에서만 ReactQueryDevtools를 동적으로 로드
const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((d) => ({
      default: d.ReactQueryDevtools,
    })),
  { ssr: false }
);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 기본값은 Dynamic Data 기준 (자주 변하는 데이터)
            // 각 쿼리에서 필요에 따라 다른 staleTime 설정 가능
            staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분
            // 캐시 유지 시간
            gcTime: CACHE_GC_TIME_DYNAMIC, // 10분
            // 재시도 설정
            retry: 1,
            // 에러 발생 시 재시도 전 대기 시간
            retryDelay: 1000,
            // 윈도우 포커스 시 자동 리페치 비활성화 (서버 컴포넌트 사용 시)
            refetchOnWindowFocus: false,
            // 네트워크 재연결 시 자동 리페치
            refetchOnReconnect: true,
          },
          mutations: {
            // 뮤테이션 실패 시 재시도
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

