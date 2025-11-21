"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  searchContentMasters,
  getContentMasterById,
  copyMasterToStudentContent,
  getSubjectList,
  getSemesterList,
  type ContentMasterFilters,
} from "@/lib/data/contentMasters";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 콘텐츠 마스터 검색
 */
async function _searchContentMasters(
  filters: ContentMasterFilters
): Promise<{ data: any[]; total: number }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();

  const result = await searchContentMasters({
    ...filters,
    tenantId: tenantContext?.tenantId || null,
  });

  return result;
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
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getContentMasterById(masterId);
}

export const getContentMasterByIdAction = withErrorHandling(_getContentMasterById);

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사
 */
async function _copyMasterToStudentContent(masterId: string): Promise<{
  bookId?: string;
  lectureId?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
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

  return await copyMasterToStudentContent(
    masterId,
    user.userId,
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
  if (!user || user.role !== "student") {
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
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSemesterList();
}

export const getSemesterListAction = withErrorHandling(_getSemesterList);

