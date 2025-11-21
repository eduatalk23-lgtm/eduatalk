"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import dynamic from "next/dynamic";

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
            // 서버 상태와의 동기화를 위해 staleTime을 짧게 설정
            staleTime: 1000 * 60, // 1분
            // 캐시 유지 시간
            gcTime: 1000 * 60 * 5, // 5분 (이전 cacheTime)
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

