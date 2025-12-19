import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/api";

/**
 * 현재 로그인한 사용자 정보를 조회하는 API 엔드포인트
 * 
 * 클라이언트 사이드에서 사용자 정보를 한 번만 로드하고 재사용하기 위해 사용됩니다.
 * React Query를 통해 캐싱됩니다.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiUnauthorized("로그인이 필요합니다.");
    }

    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error, "[api/auth/me]");
  }
}

