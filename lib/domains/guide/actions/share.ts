"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { GuideShare, GuideDetail } from "../types";
import {
  findShareByToken,
  findSharesByGuideId,
  createShare,
  revokeShare,
  regenerateShareToken,
  findGuideByIdPublic,
} from "../repository";

const LOG_CTX = { domain: "guide", action: "share" };

/** 공유 링크 생성 */
export async function createShareLinkAction(
  guideId: string,
  visibleSections: string[],
): Promise<ActionResponse<GuideShare>> {
  try {
    await requireAdminOrConsultant();
    const user = await getCachedAuthUser();
    if (!user) return { success: false, error: "인증 정보 없음" };

    const share = await createShare(guideId, visibleSections, user.id);
    return { success: true, data: share };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "createShareLink" }, error);
    return { success: false, error: "공유 링크 생성에 실패했습니다." };
  }
}

/** 가이드의 공유 목록 */
export async function listSharesAction(
  guideId: string,
): Promise<ActionResponse<GuideShare[]>> {
  try {
    await requireAdminOrConsultant();
    const shares = await findSharesByGuideId(guideId);
    return { success: true, data: shares };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "listShares" }, error);
    return { success: false, error: "공유 목록 조회에 실패했습니다." };
  }
}

/** 공유 링크 비활성화 */
export async function revokeShareAction(
  shareId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await revokeShare(shareId);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "revokeShare" }, error);
    return { success: false, error: "공유 링크 폐기에 실패했습니다." };
  }
}

/** 공유 토큰 재생성 */
export async function regenerateShareTokenAction(
  shareId: string,
): Promise<ActionResponse<GuideShare>> {
  try {
    await requireAdminOrConsultant();
    const share = await regenerateShareToken(shareId);
    return { success: true, data: share };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "regenerateShareToken" }, error);
    return { success: false, error: "토큰 재생성에 실패했습니다." };
  }
}

/** 공유 토큰으로 가이드 조회 (인증 불필요) */
export async function fetchSharedGuideAction(
  token: string,
): Promise<
  ActionResponse<{ guide: GuideDetail; visibleSections: string[] }>
> {
  try {
    const share = await findShareByToken(token);
    if (!share) {
      return { success: false, error: "유효하지 않은 공유 링크입니다." };
    }

    const guide = await findGuideByIdPublic(share.guide_id);
    if (!guide) {
      return { success: false, error: "가이드를 찾을 수 없습니다." };
    }

    return {
      success: true,
      data: { guide, visibleSections: share.visible_sections },
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSharedGuide" }, error);
    return { success: false, error: "공유 가이드 조회에 실패했습니다." };
  }
}
