/**
 * revalidatePath 최적화 유틸리티
 * 
 * 현재 경로를 확인하여 필요한 경로만 revalidate합니다.
 * Server Action에서 사용합니다.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * 현재 요청 경로를 확인하고 해당 경로만 revalidate합니다.
 * 
 * @param additionalPaths 추가로 revalidate할 경로 (선택사항)
 */
export async function revalidateCurrentPath(
  ...additionalPaths: string[]
): Promise<void> {
  try {
    const headersList = await headers();
    const referer = headersList.get("referer");
    
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const pathname = refererUrl.pathname;
        
        // 현재 경로가 /today 또는 /camp/today인 경우만 해당 경로 revalidate
        if (pathname.startsWith("/today") || pathname.startsWith("/camp/today")) {
          revalidatePath(pathname);
        }
      } catch {
        // URL 파싱 실패 시 무시
      }
    }
    
    // 추가 경로 revalidate
    for (const path of additionalPaths) {
      revalidatePath(path);
    }
  } catch (error) {
    // headers() 실패 시 fallback: 모든 경로 revalidate
    revalidatePath("/today");
    revalidatePath("/camp/today");
    for (const path of additionalPaths) {
      revalidatePath(path);
    }
  }
}

/**
 * 타이머 관련 경로만 선택적으로 revalidate합니다.
 * 
 * @param campMode 캠프 모드 여부 (기본값: false)
 * @param includeDashboard 대시보드도 revalidate할지 여부 (기본값: false)
 */
export async function revalidateTimerPaths(
  campMode: boolean = false,
  includeDashboard: boolean = false
): Promise<void> {
  try {
    const headersList = await headers();
    const referer = headersList.get("referer");
    
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const pathname = refererUrl.pathname;
        
        // 현재 경로만 revalidate
        if (pathname.startsWith("/today") || pathname.startsWith("/camp/today")) {
          revalidatePath(pathname);
          
          // 대시보드도 필요한 경우
          if (includeDashboard) {
            revalidatePath("/dashboard");
          }
          
          return;
        }
      } catch {
        // URL 파싱 실패 시 fallback
      }
    }
    
    // Fallback: campMode에 따라 해당 경로만 revalidate
    if (campMode) {
      revalidatePath("/camp/today");
    } else {
      revalidatePath("/today");
    }
    
    if (includeDashboard) {
      revalidatePath("/dashboard");
    }
  } catch (error) {
    // headers() 실패 시 fallback: 모든 경로 revalidate
    revalidatePath("/today");
    revalidatePath("/camp/today");
    if (includeDashboard) {
      revalidatePath("/dashboard");
    }
  }
}

