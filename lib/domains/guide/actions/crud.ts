"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type {
  ExplorationGuide,
  GuideDetail,
  GuideUpsertInput,
  GuideContentInput,
  GuideListFilter,
  GuideVersionItem,
} from "../types";
import {
  findGuides,
  findGuideById,
  createGuide,
  updateGuide,
  deleteGuide,
  upsertGuideContent,
  replaceSubjectMappings,
  replaceCareerMappings,
  findAllSubjects,
  findVersionHistory,
  createNewVersion,
  revertToVersion,
} from "../repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedSingleGuide } from "../vector/embedding-service";

const LOG_CTX = { domain: "guide", action: "crud" };

// ============================================================
// 가이드 목록/상세 (CMS용 — 모든 status 조회 가능)
// ============================================================

/** CMS 가이드 목록 (status 필터 없이 전체 조회) */
export async function listGuidesAction(
  filters: GuideListFilter,
): Promise<ActionResponse<{ data: ExplorationGuide[]; count: number }>> {
  try {
    await requireAdminOrConsultant();
    const result = await findGuides(filters);
    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "listGuides" }, error, { filters });
    return createErrorResponse("가이드 목록을 불러올 수 없습니다.");
  }
}

/** CMS 가이드 상세 */
export async function getGuideDetailAction(
  guideId: string,
): Promise<ActionResponse<GuideDetail | null>> {
  try {
    await requireAdminOrConsultant();
    const data = await findGuideById(guideId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getGuideDetail" }, error, { guideId });
    return createErrorResponse("가이드 상세를 불러올 수 없습니다.");
  }
}

// ============================================================
// 가이드 CRUD
// ============================================================

/** 가이드 생성 */
export async function createGuideAction(input: {
  meta: GuideUpsertInput;
  content: GuideContentInput;
  subjectIds: string[];
  careerFieldIds: number[];
}): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();

    const guide = await createGuide({
      ...input.meta,
      sourceType: "manual",
      contentFormat: "html",
      status: input.meta.status ?? "draft",
      registeredBy: userId,
    });

    // 본문, 과목, 계열 병렬 저장
    await Promise.all([
      upsertGuideContent(guide.id, input.content),
      replaceSubjectMappings(
        guide.id,
        input.subjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(guide.id, input.careerFieldIds),
    ]);

    // 임베딩 생성 (실패해도 저장은 유지)
    embedSingleGuide(guide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "createGuide.embedding" }, err, {
        guideId: guide.id,
      });
    });

    return createSuccessResponse(guide);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "createGuide" }, error, {
      title: input.meta.title,
    });
    return createErrorResponse("가이드 생성에 실패했습니다.");
  }
}

/** 가이드 업데이트 */
export async function updateGuideAction(input: {
  guideId: string;
  meta: Partial<GuideUpsertInput>;
  content: GuideContentInput;
  subjectIds: string[];
  careerFieldIds: number[];
}): Promise<ActionResponse<ExplorationGuide>> {
  try {
    await requireAdminOrConsultant();

    const guide = await updateGuide(input.guideId, {
      ...input.meta,
      contentFormat: "html",
    });

    await Promise.all([
      upsertGuideContent(input.guideId, input.content),
      replaceSubjectMappings(
        input.guideId,
        input.subjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(input.guideId, input.careerFieldIds),
    ]);

    // 임베딩 갱신 (실패해도 저장은 유지)
    embedSingleGuide(input.guideId).catch((err) => {
      logActionError({ ...LOG_CTX, action: "updateGuide.embedding" }, err, {
        guideId: input.guideId,
      });
    });

    return createSuccessResponse(guide);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateGuide" }, error, {
      guideId: input.guideId,
    });
    return createErrorResponse("가이드 수정에 실패했습니다.");
  }
}

/** 가이드 삭제 */
export async function deleteGuideAction(
  guideId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await deleteGuide(guideId);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteGuide" }, error, { guideId });
    return createErrorResponse("가이드 삭제에 실패했습니다.");
  }
}

// ============================================================
// 이미지 업로드
// ============================================================

/** 가이드 이미지 업로드 → Storage URL 반환 */
export async function uploadGuideImageAction(
  guideId: string,
  formData: FormData,
): Promise<ActionResponse<string>> {
  try {
    await requireAdminOrConsultant();

    const file = formData.get("file") as File | null;
    if (!file) {
      return createErrorResponse("파일이 없습니다.");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse("JPG, PNG, WebP, GIF만 지원합니다.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return createErrorResponse("파일 크기는 5MB 이하여야 합니다.");
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const filePath = `${guideId}/${Date.now()}.${ext}`;

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse("서버 설정 오류: 스토리지에 접근할 수 없습니다.");
    }
    const { error: uploadError } = await supabase.storage
      .from("guide-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("guide-images").getPublicUrl(filePath);

    return createSuccessResponse(publicUrl);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "uploadGuideImage" }, error, {
      guideId,
    });
    return createErrorResponse("이미지 업로드에 실패했습니다.");
  }
}

// ============================================================
// 버전 관리 (C4)
// ============================================================

/** 버전 히스토리 조회 */
export async function getVersionHistoryAction(
  guideId: string,
): Promise<ActionResponse<GuideVersionItem[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findVersionHistory(guideId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getVersionHistory" }, error, { guideId });
    return createErrorResponse("버전 히스토리를 불러올 수 없습니다.");
  }
}

/** 새 버전으로 저장 (현재 가이드 복제 → 새 버전) */
export async function saveAsNewVersionAction(
  guideId: string,
): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const newGuide = await createNewVersion(guideId, userId);

    // 임베딩 생성
    embedSingleGuide(newGuide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "saveAsNewVersion.embedding" }, err, {
        guideId: newGuide.id,
      });
    });

    return createSuccessResponse(newGuide);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveAsNewVersion" }, error, { guideId });
    return createErrorResponse("새 버전 생성에 실패했습니다.");
  }
}

/** 특정 버전으로 되돌리기 */
export async function revertToVersionAction(
  targetVersionId: string,
): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const newGuide = await revertToVersion(targetVersionId, userId);

    embedSingleGuide(newGuide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "revertToVersion.embedding" }, err, {
        guideId: newGuide.id,
      });
    });

    return createSuccessResponse(newGuide);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "revertToVersion" }, error, { targetVersionId });
    return createErrorResponse("버전 되돌리기에 실패했습니다.");
  }
}

// ============================================================
// 참조 데이터
// ============================================================

/** 전체 과목 목록 */
export async function fetchAllSubjectsAction(): Promise<
  ActionResponse<Array<{ id: string; name: string }>>
> {
  try {
    await requireAdminOrConsultant();
    const data = await findAllSubjects();
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAllSubjects" }, error);
    return createErrorResponse("과목 목록을 불러올 수 없습니다.");
  }
}
