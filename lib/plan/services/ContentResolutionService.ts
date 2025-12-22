/**
 * 콘텐츠 해석 서비스
 *
 * 플랜 생성 시 콘텐츠 ID 해석, 메타데이터 로딩, 챕터 정보 로딩을 담당합니다.
 * 기존 contentResolver.ts의 함수들을 서비스 레이어로 래핑합니다.
 *
 * Phase 4: 통합 에러/로깅 시스템 적용
 *
 * @module lib/plan/services/ContentResolutionService
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveContentIds,
  loadContentMetadata,
  loadContentDurations,
  loadContentChapters,
} from "@/lib/plan/contentResolver";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
} from "@/lib/types/plan-generation";
import type { PlanContent, ContentType } from "@/lib/types/plan";
import type {
  ServiceResult,
  ServiceContext,
  ContentResolutionInput,
  ContentResolutionOutput,
  IContentResolutionService,
} from "./types";
import {
  ServiceError,
  ServiceErrorCodes,
  toServiceError,
} from "./errors";
import {
  createServiceLogger,
  globalPerformanceTracker,
} from "./logging";

// DetailIdMap은 types.ts에서 정의
type DetailIdMap = Map<string, string>;
// ChapterMap 타입 - contentResolver에서 반환하는 형태
type ContentChapterMap = Map<string, string | null>;

/**
 * 콘텐츠 해석 서비스 구현
 */
export class ContentResolutionService implements IContentResolutionService {
  /**
   * 콘텐츠 ID 해석 및 모든 메타데이터 로딩
   */
  async resolve(
    input: ContentResolutionInput
  ): Promise<ServiceResult<ContentResolutionOutput>> {
    const { contents, context } = input;

    // 로거 및 성능 추적 설정
    const logger = createServiceLogger("ContentResolutionService", {
      studentId: context.studentId,
      tenantId: context.tenantId,
    });
    const trackingId = globalPerformanceTracker.start(
      "ContentResolutionService",
      "resolve",
      undefined,
      { contentsCount: contents.length, isCampMode: context.isCampMode }
    );

    try {
      logger.info("resolve", "콘텐츠 해석 시작", {
        contentsCount: contents.length,
        isCampMode: context.isCampMode,
      });

      // Supabase 클라이언트 생성
      const adminClient = createSupabaseAdminClient();
      const serverClient = await createSupabaseServerClient();

      if (!adminClient || !serverClient) {
        const error = new ServiceError(
          "Supabase 클라이언트 생성 실패",
          ServiceErrorCodes.CLIENT_CREATION_FAILED,
          { source: "ContentResolutionService", method: "resolve" }
        );
        logger.error("resolve", "클라이언트 생성 실패", error);
        globalPerformanceTracker.end(trackingId, false);
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
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
        const copyResult = await this.copyMissingMasterContents(
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
          copyResult.data.detailIdMap.forEach((studentDetailId, masterDetailId) => {
            detailIdMap.set(masterDetailId, studentDetailId);
          });
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
      const rawChapterMap = await loadContentChapters(
        planContents,
        contentIdMap,
        context.studentId,
        serverClient
      );

      // ChapterMap을 서비스 출력 형식으로 변환
      // rawChapterMap은 Map<string, string | null>
      // 출력 chapterMap도 동일한 형식 사용
      const chapterMap = rawChapterMap;

      logger.info("resolve", "콘텐츠 해석 완료", {
        contentIdMapSize: contentIdMap.size,
        metadataMapSize: contentMetadataMap.size,
        durationMapSize: contentDurationMap.size,
        chapterMapSize: chapterMap.size,
      });
      globalPerformanceTracker.end(trackingId, true);

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
      const serviceError = toServiceError(error, "ContentResolutionService", {
        code: ServiceErrorCodes.CONTENT_RESOLUTION_FAILED,
        method: "resolve",
        studentId: context.studentId,
        tenantId: context.tenantId,
        metadata: { contentsCount: contents.length },
      });
      logger.error("resolve", "콘텐츠 해석 실패", serviceError);
      globalPerformanceTracker.end(trackingId, false);

      return {
        success: false,
        error: serviceError.message,
        errorCode: serviceError.code,
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
  ): Promise<ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>> {
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
              result.episodeIdMap.forEach((studentEpisodeId, masterEpisodeId) => {
                detailIdMap.set(masterEpisodeId, studentEpisodeId);
              });
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
      const serviceError = toServiceError(error, "ContentResolutionService", {
        code: ServiceErrorCodes.MASTER_CONTENT_COPY_FAILED,
        method: "copyMasterContents",
        studentId: context.studentId,
        tenantId: context.tenantId,
        metadata: { contentIds, contentType },
      });
      const logger = createServiceLogger("ContentResolutionService", {
        studentId: context.studentId,
        tenantId: context.tenantId,
      });
      logger.error("copyMasterContents", "마스터 콘텐츠 복사 실패", serviceError);

      return {
        success: false,
        error: serviceError.message,
        errorCode: serviceError.code,
      };
    }
  }

  /**
   * 누락된 학생 콘텐츠 복사 (내부 헬퍼)
   */
  private async copyMissingMasterContents(
    contents: PlanContent[],
    contentIdMap: ContentIdMap,
    context: ServiceContext
  ): Promise<ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>> {
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
        bookResult.data.contentIdMap.forEach((v, k) => resultContentIdMap.set(k, v));
        bookResult.data.detailIdMap.forEach((v, k) => resultDetailIdMap.set(k, v));
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
        lectureResult.data.contentIdMap.forEach((v, k) => resultContentIdMap.set(k, v));
        lectureResult.data.detailIdMap.forEach((v, k) => resultDetailIdMap.set(k, v));
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

// 싱글톤 인스턴스
let instance: ContentResolutionService | null = null;

/**
 * ContentResolutionService 싱글톤 인스턴스 반환
 */
export function getContentResolutionService(): ContentResolutionService {
  if (!instance) {
    instance = new ContentResolutionService();
  }
  return instance;
}
