import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { BlockSetWithBlocks } from "@/lib/data/blockSets";

/**
 * 블록 세트 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param studentId - 학생 ID
 * @returns React Query 쿼리 옵션
 */
export function blockSetsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ["blockSets", studentId] as const,
    queryFn: async (): Promise<BlockSetWithBlocks[]> => {
      const response = await fetch("/api/block-sets", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "블록 세트 조회 실패";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          // JSON 파싱 실패 시 원본 텍스트 사용
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      // API 응답이 { success: true, data: BlockSetWithBlocks[] } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as BlockSetWithBlocks[];
      }
      
      // 직접 BlockSetWithBlocks[] 형식인 경우
      return responseData as BlockSetWithBlocks[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

