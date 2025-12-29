import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { ContentItem } from "@/lib/data/planContents";

/**
 * 학생 콘텐츠 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param studentId - 학생 ID
 * @returns React Query 쿼리 옵션
 */
export function studentContentsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ["studentContents", studentId] as const,
    queryFn: async (): Promise<{
      books: ContentItem[];
      lectures: ContentItem[];
      custom: ContentItem[];
    }> => {
      const response = await fetch("/api/student-contents");

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "학생 콘텐츠 조회 실패";
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
      
      // API 응답이 { success: true, data: ... } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as {
          books: ContentItem[];
          lectures: ContentItem[];
          custom: ContentItem[];
        };
      }
      
      // 직접 형식인 경우
      return responseData as {
        books: ContentItem[];
        lectures: ContentItem[];
        custom: ContentItem[];
      };
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

