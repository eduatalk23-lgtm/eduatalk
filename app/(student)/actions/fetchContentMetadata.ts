"use server";

/**
 * 콘텐츠 메타데이터 조회 서버 액션
 * 클라이언트 컴포넌트에서 호출 가능한 서버 액션
 */

import { fetchContentMetadata, fetchContentMetadataBatch } from "@/lib/data/contentMetadata";
import { toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

/**
 * 단일 콘텐츠 메타데이터 조회
 */
export async function fetchContentMetadataAction(
  contentId: string,
  contentType: "book" | "lecture"
) {
  try {
    const user = await getCurrentUser();
    const studentId = user?.userId;

    const metadata = await fetchContentMetadata(
      contentId,
      contentType,
      studentId
    );

    return { success: true, data: metadata };
  } catch (error) {
    const planGroupError = toPlanGroupError(
      error,
      PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
    );
    return {
      success: false,
      error: planGroupError.userMessage,
      code: planGroupError.code,
    };
  }
}

/**
 * 여러 콘텐츠 메타데이터 배치 조회
 */
export async function fetchContentMetadataBatchAction(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>
) {
  try {
    const user = await getCurrentUser();
    const studentId = user?.userId;

    const metadataMap = await fetchContentMetadataBatch(contents, studentId);

    return {
      success: true,
      data: Object.fromEntries(metadataMap),
    };
  } catch (error) {
    const planGroupError = toPlanGroupError(
      error,
      PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
    );
    return {
      success: false,
      error: planGroupError.userMessage,
      code: planGroupError.code,
    };
  }
}

