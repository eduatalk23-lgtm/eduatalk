import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";

/**
 * 서버 컴포넌트에서 사용할 QueryClient를 생성하는 함수
 * React의 cache를 사용하여 요청당 하나의 인스턴스만 생성되도록 보장
 */
export const getQueryClient = cache(() => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분
        gcTime: CACHE_GC_TIME_DYNAMIC, // 10분
        retry: 1,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
});

