"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getCurriculumRevisions,
  getGrades,
  getSemesters,
  getSubjectCategories,
  getSubjects,
  getPlatforms,
  getPublishers,
} from "@/lib/data/contentMetadata";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 개정교육과정 목록 조회
 */
async function _getCurriculumRevisions() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getCurriculumRevisions();
}

export const getCurriculumRevisionsAction = withErrorHandling(_getCurriculumRevisions);

/**
 * 학년 목록 조회
 */
async function _getGrades() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getGrades();
}

export const getGradesAction = withErrorHandling(_getGrades);

/**
 * 학기 목록 조회
 */
async function _getSemesters() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSemesters();
}

export const getSemestersAction = withErrorHandling(_getSemesters);

/**
 * 교과 목록 조회 (Deprecated: getSubjectGroupsAction 사용 권장)
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectGroupsAction을 사용하세요.
 */
async function _getSubjectCategories(revisionId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // subject_groups로 변환하여 반환 (하위 호환성)
  const { getSubjectGroupsAction } = await import("@/app/(admin)/actions/subjectActions");
  const groups = await getSubjectGroupsAction(revisionId);
  
  // SubjectCategory 형태로 변환
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    display_order: group.display_order,
    is_active: true,
  }));
}

export const getSubjectCategoriesAction = withErrorHandling(_getSubjectCategories);

/**
 * 과목 목록 조회 (Deprecated: getSubjectsByGroupAction 사용 권장)
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectsByGroupAction을 사용하세요.
 */
async function _getSubjects(subjectCategoryId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!subjectCategoryId) {
    return [];
  }

  // getSubjectsByGroupAction 사용
  const { getSubjectsByGroupAction } = await import("@/app/(admin)/actions/subjectActions");
  const subjects = await getSubjectsByGroupAction(subjectCategoryId);
  
  // Subject 형태로 변환
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    subject_category_id: subject.subject_group_id,
    display_order: subject.display_order,
    is_active: true,
  }));
}

export const getSubjectsAction = withErrorHandling(_getSubjects);

/**
 * 플랫폼 목록 조회
 */
async function _getPlatforms() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getPlatforms();
}

export const getPlatformsAction = withErrorHandling(_getPlatforms);

/**
 * 출판사 목록 조회
 */
async function _getPublishers() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getPublishers();
}

export const getPublishersAction = withErrorHandling(_getPublishers);

