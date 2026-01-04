/**
 * 통합 콘텐츠 해석 서비스
 *
 * lib/domains/plan/services/contentResolutionService.ts와
 * lib/plan/services/ContentResolutionService.ts를 통합합니다.
 *
 * 특징:
 * - 마스터 콘텐츠 → 학생 콘텐츠 복사
 * - 상세한 복사 실패 추적
 * - 배치 쿼리를 통한 성능 최적화
 * - Phase 4 에러/로깅 시스템 통합
 * - 두 가지 컨텍스트 패턴 지원 (Simple/Full)
 *
 * @module lib/plan/shared/ContentResolutionService
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import {
  resolveContentIds,
  loadContentDurations,
  loadContentMetadata,
  loadContentChapters,
} from "@/lib/plan/contentResolver";
import { isDummyContent } from "@/lib/utils/planUtils";
import {
  logActionError,
  logActionDebug,
} from "@/lib/logging/actionLogger";
import type {
  ServiceResult,
  ServiceContext,
  PlanServiceContext,
  ContentResolutionInput,
  ContentResolutionOutput,
  ContentResolutionResult,
  ResolvedContent,
  ContentCopyFailure,
  IContentResolutionService,
  ContentIdMap,
  DetailIdMap,
  ContentChapterMap,
  PlanContent,
  ContentType,
} from "./types";

// ============================================
// 에러 코드 정의
// ============================================

export const ContentResolutionErrorCodes = {
  CLIENT_CREATION_FAILED: "CLIENT_CREATION_FAILED",
  CONTENT_RESOLUTION_FAILED: "CONTENT_RESOLUTION_FAILED",
  MASTER_CONTENT_COPY_FAILED: "MASTER_CONTENT_COPY_FAILED",
  METADATA_LOAD_FAILED: "METADATA_LOAD_FAILED",
} as const;

export type ContentResolutionErrorCode =
  (typeof ContentResolutionErrorCodes)[keyof typeof ContentResolutionErrorCodes];

// ============================================
// ContentResolutionService 클래스 (Context 기반)
// ============================================

/**
 * 콘텐츠 해석 서비스 (Context 기반)
 *
 * PlanServiceContext를 사용하여 직접 DB 작업을 수행합니다.
 * 상세한 복사 실패 추적과 배치 쿼리를 지원합니다.
 */
export class ContentResolutionServiceWithContext {
  private ctx: PlanServiceContext;

  constructor(context: PlanServiceContext) {
    this.ctx = context;
  }

  /**
   * 콘텐츠를 해석하고 필요한 경우 마스터 콘텐츠를 복사합니다.
   */
  async resolveContents(
    contents: PlanContent[]
  ): Promise<ContentResolutionResult> {
    logActionDebug(
      { domain: "plan", action: "resolveContents" },
      "콘텐츠 해석 시작",
      { groupId: this.ctx.groupId, contentsCount: contents.length }
    );

    // 1. 콘텐츠 분류
    const { bookContents, lectureContents, customContents } =
      this.classifyContents(contents);

    // 2. 기본 ID 매핑 생성 (기존 학생 콘텐츠 확인)
    const contentIdMap = await this.createInitialIdMap(
      contents,
      bookContents,
      lectureContents,
      customContents
    );

    // 3. 누락된 콘텐츠 식별 및 마스터 콘텐츠 복사
    const { detailIdMap, copyFailures } = await this.copyMissingMasterContents(
      bookContents,
      lectureContents,
      contentIdMap
    );

    // 4. 메타데이터 로드
    const metadataMap = await loadContentMetadata(
      contents,
      contentIdMap,
      this.ctx.studentId,
      this.ctx.queryClient,
      this.ctx.masterQueryClient
    );

    // 5. 소요시간 로드
    const durationMap = await loadContentDurations(
      contents,
      contentIdMap,
      this.ctx.studentId,
      this.ctx.queryClient,
      this.ctx.masterQueryClient
    );

    // 6. 챕터 정보 로드
    const chapterMap = await loadContentChapters(
      contents,
      contentIdMap,
      this.ctx.studentId,
      this.ctx.queryClient,
      this.ctx.masterQueryClient
    );

    // 7. 해석된 콘텐츠 목록 생성
    const resolvedContents = this.buildResolvedContents(
      contents,
      contentIdMap,
      copyFailures
    );

    logActionDebug(
      { domain: "plan", action: "resolveContents" },
      "콘텐츠 해석 완료",
      {
        groupId: this.ctx.groupId,
        contentIdMapSize: contentIdMap.size,
        copyFailuresCount: copyFailures.length,
      }
    );

    return {
      resolvedContents,
      contentIdMap,
      detailIdMap,
      copyFailures,
      metadataMap,
      durationMap,
      chapterMap,
    };
  }

  /**
   * 콘텐츠를 타입별로 분류합니다.
   */
  private classifyContents(contents: PlanContent[]) {
    type ContentWithResolved = PlanContent & { resolvedContentId: string };

    const getResolvedContentId = (content: PlanContent): string => {
      return content.master_content_id || content.content_id;
    };

    const bookContents: ContentWithResolved[] = contents
      .filter((c) => c.content_type === "book" && !isDummyContent(c.content_id))
      .map((c) => ({
        ...c,
        resolvedContentId: getResolvedContentId(c),
      }));

    const lectureContents: ContentWithResolved[] = contents
      .filter(
        (c) => c.content_type === "lecture" && !isDummyContent(c.content_id)
      )
      .map((c) => ({
        ...c,
        resolvedContentId: getResolvedContentId(c),
      }));

    const customContents = contents.filter(
      (c) => c.content_type === "custom" || isDummyContent(c.content_id)
    );

    return { bookContents, lectureContents, customContents };
  }

  /**
   * 초기 ID 매핑을 생성합니다.
   */
  private async createInitialIdMap(
    contents: PlanContent[],
    bookContents: Array<PlanContent & { resolvedContentId: string }>,
    lectureContents: Array<PlanContent & { resolvedContentId: string }>,
    customContents: PlanContent[]
  ): Promise<ContentIdMap> {
    const contentIdMap: ContentIdMap = new Map();

    // 더미/커스텀 콘텐츠는 그대로 매핑
    customContents.forEach((c) => contentIdMap.set(c.content_id, c.content_id));
    contents
      .filter((c) => isDummyContent(c.content_id))
      .forEach((c) => contentIdMap.set(c.content_id, c.content_id));

    // 배치 쿼리: 학생 콘텐츠 존재 여부 확인
    const [
      directBooksResult,
      directLecturesResult,
      masterBooksResult,
      masterLecturesResult,
    ] = await Promise.all([
      bookContents.length > 0
        ? this.ctx.queryClient
            .from("books")
            .select("id, master_content_id")
            .in(
              "id",
              bookContents.map((c) => c.resolvedContentId)
            )
            .eq("student_id", this.ctx.studentId)
        : Promise.resolve({ data: [] }),
      lectureContents.length > 0
        ? this.ctx.queryClient
            .from("lectures")
            .select("id, master_content_id")
            .in(
              "id",
              lectureContents.map((c) => c.resolvedContentId)
            )
            .eq("student_id", this.ctx.studentId)
        : Promise.resolve({ data: [] }),
      bookContents.length > 0
        ? this.ctx.queryClient
            .from("books")
            .select("id, master_content_id")
            .in(
              "master_content_id",
              bookContents.map((c) => c.resolvedContentId)
            )
            .eq("student_id", this.ctx.studentId)
        : Promise.resolve({ data: [] }),
      lectureContents.length > 0
        ? this.ctx.queryClient
            .from("lectures")
            .select("id, master_content_id")
            .in(
              "master_content_id",
              lectureContents.map((c) => c.resolvedContentId)
            )
            .eq("student_id", this.ctx.studentId)
        : Promise.resolve({ data: [] }),
    ]);

    // 직접 조회한 학생 콘텐츠 매핑
    (directBooksResult.data || []).forEach((b) => {
      const originalContent = bookContents.find(
        (c) => c.resolvedContentId === b.id
      );
      if (originalContent) {
        contentIdMap.set(originalContent.content_id, b.id);
      }
    });
    (directLecturesResult.data || []).forEach((l) => {
      const originalContent = lectureContents.find(
        (c) => c.resolvedContentId === l.id
      );
      if (originalContent) {
        contentIdMap.set(originalContent.content_id, l.id);
      }
    });

    // 마스터 콘텐츠 ID로 찾은 학생 콘텐츠 매핑
    const masterBooksMap = new Map(
      (masterBooksResult.data || []).map((b) => [b.master_content_id, b.id])
    );
    const masterLecturesMap = new Map(
      (masterLecturesResult.data || []).map((l) => [l.master_content_id, l.id])
    );

    bookContents.forEach((c) => {
      if (contentIdMap.has(c.content_id)) return;
      const existingId = masterBooksMap.get(c.resolvedContentId);
      if (existingId) {
        contentIdMap.set(c.content_id, existingId);
      }
    });

    lectureContents.forEach((c) => {
      if (contentIdMap.has(c.content_id)) return;
      const existingId = masterLecturesMap.get(c.resolvedContentId);
      if (existingId) {
        contentIdMap.set(c.content_id, existingId);
      }
    });

    return contentIdMap;
  }

  /**
   * 누락된 마스터 콘텐츠를 학생 콘텐츠로 복사합니다.
   */
  private async copyMissingMasterContents(
    bookContents: Array<PlanContent & { resolvedContentId: string }>,
    lectureContents: Array<PlanContent & { resolvedContentId: string }>,
    contentIdMap: ContentIdMap
  ): Promise<{ detailIdMap: DetailIdMap; copyFailures: ContentCopyFailure[] }> {
    const detailIdMap: DetailIdMap = new Map();
    const copyFailures: ContentCopyFailure[] = [];

    // 누락된 콘텐츠 필터링
    const missingBookIds = bookContents
      .filter((c) => !contentIdMap.has(c.content_id))
      .map((c) => c.resolvedContentId);
    const missingLectureIds = lectureContents
      .filter((c) => !contentIdMap.has(c.content_id))
      .map((c) => c.resolvedContentId);

    if (missingBookIds.length === 0 && missingLectureIds.length === 0) {
      return { detailIdMap, copyFailures };
    }

    // 마스터 콘텐츠 존재 여부 확인
    const [masterBooksCheckResult, masterLecturesCheckResult] =
      await Promise.all([
        missingBookIds.length > 0
          ? this.ctx.masterQueryClient
              .from("master_books")
              .select("id")
              .in("id", missingBookIds)
          : Promise.resolve({ data: [] }),
        missingLectureIds.length > 0
          ? this.ctx.masterQueryClient
              .from("master_lectures")
              .select("id")
              .in("id", missingLectureIds)
          : Promise.resolve({ data: [] }),
      ]);

    const masterBookIds = new Set(
      (masterBooksCheckResult.data || []).map((b) => b.id)
    );
    const masterLectureIds = new Set(
      (masterLecturesCheckResult.data || []).map((l) => l.id)
    );

    // 마스터 교재 복사
    for (const resolvedContentId of missingBookIds) {
      if (masterBookIds.has(resolvedContentId)) {
        try {
          const copiedBook = await copyMasterBookToStudent(
            resolvedContentId,
            this.ctx.studentId,
            this.ctx.tenantId
          );

          if (copiedBook?.bookId) {
            const originalContent = bookContents.find(
              (c) => c.resolvedContentId === resolvedContentId
            );
            if (originalContent) {
              contentIdMap.set(originalContent.content_id, copiedBook.bookId);
            }

            // detail ID 매핑 수집
            if (copiedBook.detailIdMap) {
              copiedBook.detailIdMap.forEach((studentDetailId, masterDetailId) => {
                detailIdMap.set(masterDetailId, studentDetailId);
              });
            }
          } else {
            copyFailures.push({
              contentId: resolvedContentId,
              contentType: "book",
              reason: "마스터 교재 복사 실패: bookId가 없습니다.",
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logActionError(
            { domain: "plan", action: "copyMasterBook" },
            error instanceof Error ? error : new Error(errorMessage),
            { contentId: resolvedContentId }
          );
          copyFailures.push({
            contentId: resolvedContentId,
            contentType: "book",
            reason: `마스터 교재 복사 실패: ${errorMessage}`,
          });
        }
      } else {
        // 마스터 콘텐츠가 아닌 경우
        const originalContent = bookContents.find(
          (c) => c.resolvedContentId === resolvedContentId
        );
        if (originalContent) {
          copyFailures.push({
            contentId: resolvedContentId,
            contentType: "book",
            reason:
              "교재가 마스터 교재가 아니며 학생 교재로도 찾을 수 없습니다.",
          });
        }
      }
    }

    // 마스터 강의 복사
    for (const resolvedContentId of missingLectureIds) {
      if (masterLectureIds.has(resolvedContentId)) {
        try {
          const copiedLecture = await copyMasterLectureToStudent(
            resolvedContentId,
            this.ctx.studentId,
            this.ctx.tenantId
          );

          if (copiedLecture?.lectureId) {
            const originalContent = lectureContents.find(
              (c) => c.resolvedContentId === resolvedContentId
            );
            if (originalContent) {
              contentIdMap.set(
                originalContent.content_id,
                copiedLecture.lectureId
              );
            }

            // episode ID 매핑 수집
            if (copiedLecture.episodeIdMap) {
              copiedLecture.episodeIdMap.forEach(
                (studentEpisodeId, masterEpisodeId) => {
                  detailIdMap.set(masterEpisodeId, studentEpisodeId);
                }
              );
            }
          } else {
            copyFailures.push({
              contentId: resolvedContentId,
              contentType: "lecture",
              reason: "마스터 강의 복사 실패: lectureId가 없습니다.",
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logActionError(
            { domain: "plan", action: "copyMasterLecture" },
            error instanceof Error ? error : new Error(errorMessage),
            { contentId: resolvedContentId }
          );
          copyFailures.push({
            contentId: resolvedContentId,
            contentType: "lecture",
            reason: `마스터 강의 복사 실패: ${errorMessage}`,
          });
        }
      } else {
        const originalContent = lectureContents.find(
          (c) => c.resolvedContentId === resolvedContentId
        );
        if (originalContent) {
          copyFailures.push({
            contentId: resolvedContentId,
            contentType: "lecture",
            reason:
              "강의가 마스터 강의가 아니며 학생 강의로도 찾을 수 없습니다.",
          });
        }
      }
    }

    return { detailIdMap, copyFailures };
  }

  /**
   * 해석된 콘텐츠 목록을 생성합니다.
   */
  private buildResolvedContents(
    contents: PlanContent[],
    contentIdMap: ContentIdMap,
    copyFailures: ContentCopyFailure[]
  ): ResolvedContent[] {
    const failureMap = new Map(copyFailures.map((f) => [f.contentId, f]));

    return contents.map((content) => {
      const studentContentId =
        contentIdMap.get(content.content_id) || content.content_id;
      const failure = failureMap.get(content.content_id);

      return {
        originalContentId: content.content_id,
        resolvedContentId: content.master_content_id || content.content_id,
        studentContentId,
        contentType: content.content_type as ContentType,
        isCopiedFromMaster: !!content.master_content_id,
        copyFailureReason: failure?.reason,
      };
    });
  }

  /**
   * plan_contents의 detail ID를 학생 콘텐츠 ID로 업데이트합니다.
   */
  async updateDetailIds(
    contents: PlanContent[],
    detailIdMap: DetailIdMap
  ): Promise<void> {
    if (detailIdMap.size === 0) return;

    const contentsToUpdate = contents.filter(
      (c) =>
        (c.start_detail_id && detailIdMap.has(c.start_detail_id)) ||
        (c.end_detail_id && detailIdMap.has(c.end_detail_id))
    );

    for (const content of contentsToUpdate) {
      const updateData: { start_detail_id?: string; end_detail_id?: string } =
        {};

      if (content.start_detail_id && detailIdMap.has(content.start_detail_id)) {
        updateData.start_detail_id = detailIdMap.get(content.start_detail_id)!;
      }
      if (content.end_detail_id && detailIdMap.has(content.end_detail_id)) {
        updateData.end_detail_id = detailIdMap.get(content.end_detail_id)!;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await this.ctx.queryClient
          .from("plan_contents")
          .update(updateData)
          .eq("id", content.id);

        if (updateError) {
          logActionError(
            { domain: "plan", action: "updateDetailIds" },
            updateError,
            { contentId: content.id, updateData }
          );
        } else {
          // 로컬 contents 배열도 업데이트
          if (updateData.start_detail_id) {
            content.start_detail_id = updateData.start_detail_id;
          }
          if (updateData.end_detail_id) {
            content.end_detail_id = updateData.end_detail_id;
          }
        }
      }
    }
  }
}

// ============================================
// ContentResolutionService 클래스 (Singleton)
// ============================================

/**
 * 콘텐츠 해석 서비스 (Singleton)
 *
 * IContentResolutionService 인터페이스를 구현합니다.
 * 내부적으로 Supabase 클라이언트를 생성하여 작업합니다.
 */
export class ContentResolutionService implements IContentResolutionService {
  /**
   * 콘텐츠 ID 해석 및 모든 메타데이터 로딩
   */
  async resolve(
    input: ContentResolutionInput
  ): Promise<ServiceResult<ContentResolutionOutput>> {
    const { contents, context } = input;

    try {
      logActionDebug(
        { domain: "plan", action: "resolve" },
        "콘텐츠 해석 시작",
        { contentsCount: contents.length, isCampMode: context.isCampMode }
      );

      // Supabase 클라이언트 생성
      const adminClient = createSupabaseAdminClient();
      const serverClient = await createSupabaseServerClient();

      if (!adminClient || !serverClient) {
        return {
          success: false,
          error: "Supabase 클라이언트 생성 실패",
          errorCode: ContentResolutionErrorCodes.CLIENT_CREATION_FAILED,
        };
      }

      // PlanContent 형식으로 변환
      const planContents: PlanContent[] = contents.map((c, index) => ({
        id: `temp-${index}`,
        tenant_id: context.tenantId,
        plan_group_id: "",
        content_id: c.content_id,
        content_type: c.content_type,
        start_detail_id: c.start_detail_id ?? null,
        end_detail_id: c.end_detail_id ?? null,
        start_range: c.start_range ?? 1,
        end_range: c.end_range ?? 1,
        display_order: index,
        master_content_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // 1. 콘텐츠 ID 해석 (마스터 → 학생)
      const contentIdMap = await resolveContentIds(
        planContents,
        context.studentId,
        serverClient,
        adminClient
      );

      // 2. 캠프 모드에서 마스터 콘텐츠 복사 필요 시 처리
      const detailIdMap: DetailIdMap = new Map();

      if (context.isCampMode) {
        const copyResult = await this.copyMissingMasterContentsInternal(
          planContents,
          contentIdMap,
          context
        );

        if (copyResult.success && copyResult.data) {
          // 복사된 콘텐츠 ID 업데이트
          copyResult.data.contentIdMap.forEach((studentId, masterId) => {
            contentIdMap.set(masterId, studentId);
          });

          // 상세 ID 매핑 업데이트
          copyResult.data.detailIdMap.forEach(
            (studentDetailId, masterDetailId) => {
              detailIdMap.set(masterDetailId, studentDetailId);
            }
          );
        }
      }

      // 3. 콘텐츠 메타데이터 로딩
      const contentMetadataMap = await loadContentMetadata(
        planContents,
        contentIdMap,
        context.studentId,
        serverClient,
        adminClient
      );

      // 4. 콘텐츠 소요시간 로딩
      const contentDurationMap = await loadContentDurations(
        planContents,
        contentIdMap,
        context.studentId,
        serverClient,
        adminClient
      );

      // 5. 챕터 정보 로딩
      const chapterMap = await loadContentChapters(
        planContents,
        contentIdMap,
        context.studentId,
        serverClient
      );

      logActionDebug(
        { domain: "plan", action: "resolve" },
        "콘텐츠 해석 완료",
        {
          contentIdMapSize: contentIdMap.size,
          metadataMapSize: contentMetadataMap.size,
          durationMapSize: contentDurationMap.size,
          chapterMapSize: chapterMap.size,
        }
      );

      return {
        success: true,
        data: {
          contentIdMap,
          detailIdMap,
          contentMetadataMap,
          contentDurationMap,
          chapterMap,
        },
      };
    } catch (error) {
      logActionError(
        { domain: "plan", action: "resolve" },
        error instanceof Error ? error : new Error(String(error)),
        { contentsCount: contents.length }
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "콘텐츠 해석에 실패했습니다",
        errorCode: ContentResolutionErrorCodes.CONTENT_RESOLUTION_FAILED,
      };
    }
  }

  /**
   * 마스터 콘텐츠를 학생 콘텐츠로 복사 (캠프 모드)
   */
  async copyMasterContents(
    contentIds: string[],
    contentType: ContentType,
    context: ServiceContext
  ): Promise<
    ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>
  > {
    try {
      const contentIdMap: ContentIdMap = new Map();
      const detailIdMap: DetailIdMap = new Map();

      for (const masterId of contentIds) {
        if (contentType === "book") {
          const result = await copyMasterBookToStudent(
            masterId,
            context.studentId,
            context.tenantId
          );

          if (result) {
            contentIdMap.set(masterId, result.bookId);
            if (result.detailIdMap) {
              result.detailIdMap.forEach((studentDetailId, masterDetailId) => {
                detailIdMap.set(masterDetailId, studentDetailId);
              });
            }
          } else {
            contentIdMap.set(masterId, masterId);
          }
        } else if (contentType === "lecture") {
          const result = await copyMasterLectureToStudent(
            masterId,
            context.studentId,
            context.tenantId
          );

          if (result) {
            contentIdMap.set(masterId, result.lectureId);
            if (result.episodeIdMap) {
              result.episodeIdMap.forEach(
                (studentEpisodeId, masterEpisodeId) => {
                  detailIdMap.set(masterEpisodeId, studentEpisodeId);
                }
              );
            }
          } else {
            contentIdMap.set(masterId, masterId);
          }
        } else {
          // custom 타입은 복사 불필요
          contentIdMap.set(masterId, masterId);
        }
      }

      return {
        success: true,
        data: { contentIdMap, detailIdMap },
      };
    } catch (error) {
      logActionError(
        { domain: "plan", action: "copyMasterContents" },
        error instanceof Error ? error : new Error(String(error)),
        { contentIds, contentType }
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "마스터 콘텐츠 복사에 실패했습니다",
        errorCode: ContentResolutionErrorCodes.MASTER_CONTENT_COPY_FAILED,
      };
    }
  }

  /**
   * 누락된 학생 콘텐츠 복사 (내부 헬퍼)
   */
  private async copyMissingMasterContentsInternal(
    contents: PlanContent[],
    contentIdMap: ContentIdMap,
    context: ServiceContext
  ): Promise<
    ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>
  > {
    // 아직 학생 콘텐츠가 없는 마스터 콘텐츠 찾기
    const missingBooks: string[] = [];
    const missingLectures: string[] = [];

    contents.forEach((content) => {
      const mappedId = contentIdMap.get(content.content_id);

      // 매핑된 ID가 원본과 같으면 아직 복사되지 않은 것
      if (mappedId === content.content_id) {
        if (content.content_type === "book") {
          missingBooks.push(content.content_id);
        } else if (content.content_type === "lecture") {
          missingLectures.push(content.content_id);
        }
      }
    });

    const resultContentIdMap: ContentIdMap = new Map();
    const resultDetailIdMap: DetailIdMap = new Map();

    // 교재 복사
    if (missingBooks.length > 0) {
      const bookResult = await this.copyMasterContents(
        missingBooks,
        "book",
        context
      );

      if (bookResult.success && bookResult.data) {
        bookResult.data.contentIdMap.forEach((v, k) =>
          resultContentIdMap.set(k, v)
        );
        bookResult.data.detailIdMap.forEach((v, k) =>
          resultDetailIdMap.set(k, v)
        );
      }
    }

    // 강의 복사
    if (missingLectures.length > 0) {
      const lectureResult = await this.copyMasterContents(
        missingLectures,
        "lecture",
        context
      );

      if (lectureResult.success && lectureResult.data) {
        lectureResult.data.contentIdMap.forEach((v, k) =>
          resultContentIdMap.set(k, v)
        );
        lectureResult.data.detailIdMap.forEach((v, k) =>
          resultDetailIdMap.set(k, v)
        );
      }
    }

    return {
      success: true,
      data: {
        contentIdMap: resultContentIdMap,
        detailIdMap: resultDetailIdMap,
      },
    };
  }
}

// ============================================
// 팩토리 함수
// ============================================

// Singleton 인스턴스
let singletonInstance: ContentResolutionService | null = null;

/**
 * ContentResolutionService Singleton 인스턴스 반환
 */
export function getContentResolutionService(): ContentResolutionService {
  if (!singletonInstance) {
    singletonInstance = new ContentResolutionService();
  }
  return singletonInstance;
}

/**
 * Context 기반 ContentResolutionService 인스턴스 생성
 */
export function createContentResolutionService(
  context: PlanServiceContext
): ContentResolutionServiceWithContext {
  return new ContentResolutionServiceWithContext(context);
}
