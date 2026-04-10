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
  CurriculumUnit,
  GuideType,
  GuideStatus,
  SuggestedTopic,
  TopicListFilter,
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
  replaceClassificationMappings,
  findAllSubjects,
  findVersionHistory,
  createNewVersion,
  revertToVersion,
  findCurriculumUnitsBySubject,
  findAllCurriculumUnits,
  searchGuideTitles,
  countSimilarGuides,
  fetchStudentCareerInfo,
  findPopularGuidesByClassification,
  findLatestVersionId,
} from "../repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** 임베딩 생성 + 자동 분류 (클러스터/난이도/사슬 링크) 체이닝 */
async function lazyEmbedSingleGuide(guideId: string) {
  const { embedSingleGuide } = await import("../vector/embedding-service");
  const ok = await embedSingleGuide(guideId);
  if (ok) {
    const { autoClassifyGuide } = await import("../vector/auto-classify");
    await autoClassifyGuide(guideId);
  }
  return ok;
}

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
  classificationIds?: number[];
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

    // 본문, 과목, 계열, 소분류 병렬 저장
    await Promise.all([
      upsertGuideContent(guide.id, input.content),
      replaceSubjectMappings(
        guide.id,
        input.subjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(guide.id, input.careerFieldIds),
      input.classificationIds?.length
        ? replaceClassificationMappings(guide.id, input.classificationIds)
        : Promise.resolve(),
    ]);

    // 임베딩 생성 (실패해도 저장은 유지)
    lazyEmbedSingleGuide(guide.id).catch((err) => {
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
  classificationIds?: number[];
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
      input.classificationIds != null
        ? replaceClassificationMappings(input.guideId, input.classificationIds)
        : Promise.resolve(),
    ]);

    // 임베딩 갱신 (실패해도 저장은 유지)
    lazyEmbedSingleGuide(input.guideId).catch((err) => {
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
  versionMessage?: string,
): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const newGuide = await createNewVersion(guideId, userId, versionMessage);

    // 수동 편집 버전 메타 설정
    await updateGuide(newGuide.id, {
      sourceType: "manual_edit",
      versionMessage: versionMessage ?? "수동 편집 새 버전",
    });

    // 임베딩 생성
    lazyEmbedSingleGuide(newGuide.id).catch((err) => {
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

/** 편집 내용을 새 버전으로 저장 (복제 → 편집 내용 덮어쓰기) */
export async function saveWithNewVersionAction(input: {
  sourceGuideId: string;
  meta: Partial<GuideUpsertInput>;
  content: GuideContentInput;
  subjectIds: string[];
  careerFieldIds: number[];
  classificationIds?: number[];
  versionMessage: string;
}): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();

    // 1. 새 버전 생성 (원본 복제)
    const newGuide = await createNewVersion(input.sourceGuideId, userId, input.versionMessage);

    // 2. 편집 내용으로 덮어쓰기
    await updateGuide(newGuide.id, {
      ...input.meta,
      sourceType: "manual_edit",
      versionMessage: input.versionMessage,
      contentFormat: "html",
    });

    // 3. 본문 + 매핑 갱신
    await Promise.all([
      upsertGuideContent(newGuide.id, input.content),
      replaceSubjectMappings(
        newGuide.id,
        input.subjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(newGuide.id, input.careerFieldIds),
      input.classificationIds != null
        ? replaceClassificationMappings(newGuide.id, input.classificationIds)
        : Promise.resolve(),
    ]);

    // 4. 임베딩 갱신
    lazyEmbedSingleGuide(newGuide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "saveWithNewVersion.embedding" }, err, {
        guideId: newGuide.id,
      });
    });

    return createSuccessResponse(newGuide);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveWithNewVersion" }, error, {
      guideId: input.sourceGuideId,
    });
    return createErrorResponse("새 버전 저장에 실패했습니다.");
  }
}

/** 특정 버전으로 되돌리기 */
export async function revertToVersionAction(
  targetVersionId: string,
): Promise<ActionResponse<ExplorationGuide>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const newGuide = await revertToVersion(targetVersionId, userId);

    lazyEmbedSingleGuide(newGuide.id).catch((err) => {
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

// ============================================================
// 키워드 추천 / 자동완성
// ============================================================

/** 과목별 교육과정 단원 목록 */
export async function fetchCurriculumUnitsAction(
  subjectName: string,
): Promise<ActionResponse<CurriculumUnit[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findCurriculumUnitsBySubject(subjectName);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchCurriculumUnits" }, error, {
      subjectName,
    });
    return createErrorResponse("교육과정 단원을 불러올 수 없습니다.");
  }
}

/** 전체 교육과정 단원 목록 (cascading dropdown용) */
export async function fetchAllCurriculumUnitsAction(): Promise<
  ActionResponse<CurriculumUnit[]>
> {
  try {
    await requireAdminOrConsultant();
    const data = await findAllCurriculumUnits();
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAllCurriculumUnits" }, error);
    return createErrorResponse("교육과정 데이터를 불러올 수 없습니다.");
  }
}

/** 가이드 제목 자동완성 */
export async function searchGuideTitlesAction(
  query: string,
): Promise<
  ActionResponse<Array<{ id: string; title: string; guide_type: string }>>
> {
  try {
    await requireAdminOrConsultant();
    if (query.trim().length < 2) return createSuccessResponse([]);
    const data = await searchGuideTitles(query, 10);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "searchGuideTitles" }, error, {
      query,
    });
    return createErrorResponse("가이드 검색에 실패했습니다.");
  }
}

/** 유사 제목 가이드 개수 */
export async function countSimilarGuidesAction(
  query: string,
): Promise<ActionResponse<number>> {
  try {
    await requireAdminOrConsultant();
    if (query.trim().length < 2) return createSuccessResponse(0);
    const count = await countSimilarGuides(query);
    return createSuccessResponse(count);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "countSimilarGuides" }, error, {
      query,
    });
    return createErrorResponse("유사 가이드 확인에 실패했습니다.");
  }
}

/** 학생 진로 정보 간이 조회 */
export async function fetchStudentCareerInfoAction(
  studentId: string,
): Promise<
  ActionResponse<{
    target_major: string | null;
    target_sub_classification_id: number | null;
  }>
> {
  try {
    await requireAdminOrConsultant();
    const data = await fetchStudentCareerInfo(studentId);
    if (!data) return createErrorResponse("학생 정보를 찾을 수 없습니다.");
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchStudentCareerInfo" }, error, {
      studentId,
    });
    return createErrorResponse("학생 진로 정보를 불러올 수 없습니다.");
  }
}

/** 진로 기반 인기 가이드 (target_major → classification → 배정 횟수 정렬) */
export async function fetchPopularGuidesAction(
  targetMajor: string,
  limit?: number,
): Promise<
  ActionResponse<
    Array<{
      id: string;
      title: string;
      guide_type: string;
      assignment_count: number;
    }>
  >
> {
  try {
    await requireAdminOrConsultant();

    // target_major → classification_ids (기존 함수 재사용)
    const { getSubClassifications } = await import(
      "@/lib/domains/student/actions/classification"
    );
    const classifications = await getSubClassifications(targetMajor);
    const classificationIds = classifications.map((c) => c.id);

    if (classificationIds.length === 0) return createSuccessResponse([]);

    const data = await findPopularGuidesByClassification(
      classificationIds,
      limit,
    );
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPopularGuides" }, error, {
      targetMajor,
    });
    return createErrorResponse("인기 가이드를 불러올 수 없습니다.");
  }
}

// ============================================================
// 교육과정 인식 과목 + 조건 기반 추천
// ============================================================

/** 교육과정별 그룹핑된 과목 목록 */
export async function fetchGroupedSubjectsAction(
  curriculumRevisionId?: string,
): Promise<
  ActionResponse<
    Array<{ groupName: string; subjects: Array<{ id: string; name: string }> }>
  >
> {
  try {
    await requireAdminOrConsultant();
    const { getSubjectGroupsWithSubjects, getActiveCurriculumRevision } =
      await import("@/lib/data/subjects");

    // 교육과정 미지정 시 active revision 사용
    let revisionId = curriculumRevisionId;
    if (!revisionId) {
      const active = await getActiveCurriculumRevision();
      revisionId = active?.id;
    }

    const grouped = await getSubjectGroupsWithSubjects(revisionId);
    const result = grouped
      .filter((g) => g.subjects.length > 0)
      .map((g) => ({
        groupName: g.name,
        subjects: g.subjects.map((s) => ({ id: s.id, name: s.name })),
      }));

    return createSuccessResponse(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[fetchGroupedSubjectsAction] 실패:", errMsg, { curriculumRevisionId });
    logActionError({ ...LOG_CTX, action: "fetchGroupedSubjects" }, error);
    return createErrorResponse(`과목 목록을 불러올 수 없습니다: ${errMsg}`);
  }
}

/** 드롭다운 조건 기반 가이드 추천 (교집합 → 점진적 완화 fallback) */
export async function recommendByFiltersAction(input: {
  guideType?: string;
  subjectId?: string;
  careerFieldId?: number;
  limit?: number;
}): Promise<
  ActionResponse<Array<{ id: string; title: string; guide_type: string }>>
> {
  try {
    await requireAdminOrConsultant();

    const hasFilter = input.guideType || input.subjectId || input.careerFieldId;
    if (!hasFilter) return createSuccessResponse([]);


    const limit = input.limit ?? 10;

    // 필터 조합을 우선순위 순으로 시도 (교집합 → 점진적 완화)
    const filterCombinations = [
      // 1. 전체 교집합
      { guideType: input.guideType, subjectId: input.subjectId, careerFieldId: input.careerFieldId },
      // 2. 과목 + 유형 (계열 제외)
      ...(input.subjectId ? [{ guideType: input.guideType, subjectId: input.subjectId, careerFieldId: undefined }] : []),
      // 3. 계열 + 유형 (과목 제외)
      ...(input.careerFieldId ? [{ guideType: input.guideType, subjectId: undefined, careerFieldId: input.careerFieldId }] : []),
      // 4. 과목만
      ...(input.subjectId ? [{ guideType: undefined, subjectId: input.subjectId, careerFieldId: undefined }] : []),
      // 5. 계열만
      ...(input.careerFieldId ? [{ guideType: undefined, subjectId: undefined, careerFieldId: input.careerFieldId }] : []),
      // 6. 유형만
      ...(input.guideType ? [{ guideType: input.guideType, subjectId: undefined, careerFieldId: undefined }] : []),
    ];

    for (const combo of filterCombinations) {
      if (!combo.guideType && !combo.subjectId && !combo.careerFieldId) continue;

      let result: { data: ExplorationGuide[]; count: number };
      try {
        result = await findGuides({
          guideType: combo.guideType as GuideType | undefined,
          subjectId: combo.subjectId,
          careerFieldId: combo.careerFieldId,
          status: "approved" as GuideStatus,
          pageSize: limit,
          page: 1,
        });
      } catch {
        continue;
      }

      if (result.data && result.data.length > 0) {
        const titles = result.data.map((g) => ({
          id: g.id,
          title: g.title,
          guide_type: g.guide_type ?? "topic_exploration",
        }));
        return createSuccessResponse(titles);
      }
    }

    return createSuccessResponse([]);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "recommendByFilters" }, error, input);
    return createErrorResponse("추천 가이드를 조회할 수 없습니다.");
  }
}

// ============================================================
// 버전 체인 최신 버전 조회
// ============================================================

/** 동일 버전 체인의 최신 버전 ID 조회 */
export async function getLatestVersionIdAction(
  guideId: string,
): Promise<ActionResponse<string | null>> {
  try {
    await requireAdminOrConsultant();
    const latestId = await findLatestVersionId(guideId);
    return createSuccessResponse(latestId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getLatestVersionId" }, error, { guideId });
    return createErrorResponse("최신 버전을 찾을 수 없습니다.");
  }
}

// ============================================================
// M2: 버전 비교
// ============================================================

/** 두 버전을 비교하여 diff 결과 반환 */
export async function compareVersionsAction(
  guideIdA: string,
  guideIdB: string,
): Promise<ActionResponse<import("../utils/versionDiff").VersionDiff>> {
  try {
    await requireAdminOrConsultant();

    const [guideA, guideB] = await Promise.all([
      findGuideById(guideIdA),
      findGuideById(guideIdB),
    ]);

    if (!guideA || !guideB) {
      return createErrorResponse("비교할 버전을 찾을 수 없습니다.");
    }

    const { compareVersions } = await import("../utils/versionDiff");

    // older = 버전 번호가 작은 쪽, newer = 큰 쪽
    const [older, newer] =
      guideA.version <= guideB.version
        ? [guideA, guideB]
        : [guideB, guideA];

    const diff = compareVersions(older, newer);
    return createSuccessResponse(diff);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "compareVersions" }, error, {
      guideIdA,
      guideIdB,
    });
    return createErrorResponse("버전 비교에 실패했습니다.");
  }
}

// ============================================================
// 9. AI 추천 주제 관리
// ============================================================

/** CMS 주제 목록 (페이지네이션 + 필터) */
export async function listTopicsAction(
  filters: TopicListFilter,
): Promise<ActionResponse<{ data: SuggestedTopic[]; count: number }>> {
  try {
    await requireAdminOrConsultant();
    const { findSuggestedTopicsPaginated } = await import("../repository");
    const result = await findSuggestedTopicsPaginated(filters);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[listTopics] error:", error);
    logActionError({ ...LOG_CTX, action: "listTopics" }, error, { filters });
    return createErrorResponse("주제 목록을 불러올 수 없습니다.");
  }
}

/** 주제 삭제 */
export async function deleteTopicAction(
  topicId: string,
): Promise<ActionResponse<void>> {
  try {
    await requireAdminOrConsultant();
    const { deleteSuggestedTopic } = await import("../repository");
    await deleteSuggestedTopic(topicId);
    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteTopic" }, error, { topicId });
    return createErrorResponse("주제 삭제에 실패했습니다.");
  }
}

// ============================================
// 가이드 추천 패널용 서버 액션
// ============================================

/**
 * 채팅방 메시지에서 관심사 키워드 추출
 */
export async function fetchChatInterestTagsAction(
  roomId: string,
  subjectName: string,
): Promise<ActionResponse<string[]>> {
  try {
    await requireAdminOrConsultant();
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("chat_messages")
      .select("metadata, content")
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data) return createSuccessResponse([]);

    const keywords: string[] = [];
    for (const msg of data) {
      const meta = msg.metadata as { interestTags?: Array<{ keyword: string }> } | null;
      if (meta?.interestTags) {
        keywords.push(...meta.interestTags.map((t) => t.keyword));
      }
    }

    if (keywords.length === 0 && data.length > 0) {
      const recentTexts = data.slice(0, 10).map((m) => m.content).join(" ");
      return createSuccessResponse([subjectName, recentTexts.slice(0, 100)]);
    }

    return createSuccessResponse([...new Set(keywords)]);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchChatInterestTags" }, error, { roomId });
    return createErrorResponse("관심사 태그 추출에 실패했습니다.");
  }
}

/**
 * 가이드 텍스트 검색 (추천 패널용)
 */
export async function searchGuidesForRecommendationAction(
  query: string,
): Promise<ActionResponse<Array<{ guide_id: string; title: string; guide_type: string; book_title: string | null }>>> {
  try {
    await requireAdminOrConsultant();
    if (query.trim().length < 2) return createSuccessResponse([]);

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("exploration_guides")
      .select("id, title, guide_type, book_title")
      .eq("status", "approved")
      .or(`title.ilike.%${query}%`)
      .limit(8);

    return createSuccessResponse(
      (data ?? []).map((g) => ({
        guide_id: g.id,
        title: g.title,
        guide_type: g.guide_type,
        book_title: g.book_title,
      })),
    );
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "searchGuidesForRecommendation" }, error, { query });
    return createErrorResponse("가이드 검색에 실패했습니다.");
  }
}
