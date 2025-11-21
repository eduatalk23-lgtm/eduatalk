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
 * 교과 목록 조회
 */
async function _getSubjectCategories(revisionId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSubjectCategories(revisionId);
}

export const getSubjectCategoriesAction = withErrorHandling(_getSubjectCategories);

/**
 * 과목 목록 조회
 */
async function _getSubjects(subjectCategoryId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSubjects(subjectCategoryId);
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

