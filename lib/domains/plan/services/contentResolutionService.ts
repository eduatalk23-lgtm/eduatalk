/**
 * 콘텐츠 해석 서비스
 *
 * 플랜 생성 시 콘텐츠 ID를 해석하고, 마스터 콘텐츠를 학생 콘텐츠로 복사합니다.
 * 기존 lib/plan/contentResolver.ts의 함수들을 활용합니다.
 *
 * @module lib/domains/plan/services/contentResolutionService
 */

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
import type {
  PlanServiceContext,
  ContentResolutionResult,
  ResolvedContent,
  ContentCopyFailure,
  PlanContent,
  ContentType,
  ContentIdMap,
  DetailIdMap,
} from "./types";

// ============================================
// ContentResolutionService 클래스
// ============================================

/**
 * 콘텐츠 해석 서비스
 *
 * 플랜 콘텐츠를 해석하고 학생 콘텐츠 ID로 변환합니다.
 * - 마스터 콘텐츠 → 학생 콘텐츠 복사
 * - ID 매핑 관리
 * - 메타데이터 및 소요시간 로드
 */
export class ContentResolutionService {
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
          console.error(
            `[ContentResolutionService] plan_contents detail ID 업데이트 실패:`,
            { contentId: content.id, updateData, error: updateError }
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
// 유틸리티 함수
// ============================================

/**
 * 콘텐츠 해석 서비스 인스턴스 생성
 */
export function createContentResolutionService(
  context: PlanServiceContext
): ContentResolutionService {
  return new ContentResolutionService(context);
}
