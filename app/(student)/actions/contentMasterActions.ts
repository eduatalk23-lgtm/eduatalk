"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  searchContentMasters,
  getContentMasterById,
  copyMasterToStudentContent,
  getSubjectList,
  getSemesterList,
  type ContentMasterFilters,
} from "@/lib/data/contentMasters";
import { searchMasterBooks, searchMasterLectures } from "@/lib/data/contentMasters";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { ContentMasterSearchResult } from "@/lib/types/content-selection";

/**
 * 콘텐츠 마스터 검색
 */
async function _searchContentMasters(
  filters: ContentMasterFilters
): Promise<{ data: ContentMasterSearchResult[]; total: number }> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();

  // content_type에 따라 적절한 함수 호출
  if (filters.content_type === "book") {
    const result = await searchMasterBooks({
      curriculum_revision_id: filters.curriculum_revision_id,
      subject_group_id: filters.subject_group_id,
      subject_id: filters.subject_id,
      publisher_id: filters.publisher_id,
      search: filters.search,
      difficulty: filters.difficulty,
      sort: filters.sort as ContentSortOption | undefined,
      tenantId: tenantContext?.tenantId || null,
      limit: filters.limit,
      offset: filters.offset,
    });
    return {
      data: result.data.map((book) => ({ ...book, content_type: "book" as const })),
      total: result.total,
    };
  } else if (filters.content_type === "lecture") {
    const result = await searchMasterLectures({
      curriculum_revision_id: filters.curriculum_revision_id,
      subject_group_id: filters.subject_group_id,
      subject_id: filters.subject_id,
      platform_id: filters.platform_id,
      search: filters.search,
      difficulty: filters.difficulty,
      sort: filters.sort as ContentSortOption | undefined,
      tenantId: tenantContext?.tenantId || null,
      limit: filters.limit,
      offset: filters.offset,
    });
    return {
      data: result.data.map((lecture) => ({ ...lecture, content_type: "lecture" as const })),
      total: result.total,
    };
  } else {
    // 둘 다 검색
    const [booksResult, lecturesResult] = await Promise.all([
      searchMasterBooks({
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        publisher_id: filters.publisher_id,
        search: filters.search,
        difficulty: filters.difficulty,
        sort: filters.sort as ContentSortOption | undefined,
        tenantId: tenantContext?.tenantId || null,
        limit: filters.limit,
        offset: filters.offset,
      }),
      searchMasterLectures({
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        platform_id: filters.platform_id,
        search: filters.search,
        difficulty: filters.difficulty,
        sort: filters.sort as ContentSortOption | undefined,
        tenantId: tenantContext?.tenantId || null,
        limit: filters.limit,
        offset: filters.offset,
      }),
    ]);
    return {
      data: [
        ...booksResult.data.map((book) => ({ ...book, content_type: "book" as const })),
        ...lecturesResult.data.map((lecture) => ({ ...lecture, content_type: "lecture" as const })),
      ],
      total: booksResult.total + lecturesResult.total,
    };
  }
}

export const searchContentMastersAction = withErrorHandling(_searchContentMasters);

/**
 * 콘텐츠 마스터 상세 조회
 */
async function _getContentMasterById(masterId: string): Promise<{
  master: any | null;
  details: any[];
}> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getContentMasterById(masterId);
}

export const getContentMasterByIdAction = withErrorHandling(_getContentMasterById);

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사
 */
async function _copyMasterToStudentContent(
  masterId: string,
  targetStudentId?: string // 관리자 모드에서 사용 시
): Promise<{
  bookId?: string;
  lectureId?: string;
  contentId?: string;
}> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 관리자/컨설턴트인 경우 targetStudentId 사용, 학생인 경우 자신의 ID 사용
  const finalStudentId = targetStudentId || user.userId;

  return await copyMasterToStudentContent(
    masterId,
    finalStudentId,
    tenantContext.tenantId
  );
}

export const copyMasterToStudentContentAction = withErrorHandling(
  _copyMasterToStudentContent
);

/**
 * 과목 목록 조회
 */
async function _getSubjectList(content_type?: "book" | "lecture"): Promise<string[]> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSubjectList(content_type);
}

export const getSubjectListAction = withErrorHandling(_getSubjectList);

/**
 * 학기 목록 조회
 */
async function _getSemesterList(): Promise<string[]> {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSemesterList();
}

export const getSemesterListAction = withErrorHandling(_getSemesterList);

