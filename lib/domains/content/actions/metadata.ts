"use server";

/**
 * Content Metadata Actions
 *
 * 개정교육과정, 플랫폼, 출판사, 교과 그룹 등 메타데이터 조회
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getCurriculumRevisions,
  getPlatforms,
  getPublishers,
} from "@/lib/data/contentMetadata";
import { getSubjectGroups, getSubjectsByGroup } from "@/lib/data/subjects";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { getBooks } from "@/lib/data/studentContents";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

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

/**
 * 교과 그룹 목록 조회 (학생용)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
async function _getSubjectGroups(revisionId?: string): Promise<SubjectGroup[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await getSubjectGroups(revisionId);
}

export const getSubjectGroupsAction = withErrorHandling(_getSubjectGroups);

/**
 * 교과 그룹에 속한 과목 목록 조회 (학생용)
 * @param subjectGroupId 교과 그룹 ID
 */
async function _getSubjectsByGroup(subjectGroupId: string): Promise<Subject[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!subjectGroupId) {
    return [];
  }

  return await getSubjectsByGroup(subjectGroupId);
}

export const getSubjectsByGroupAction = withErrorHandling(_getSubjectsByGroup);

/**
 * 학생의 교재 목록 조회
 */
async function _getStudentBooks(): Promise<Array<{ id: string; title: string }>> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();
  const books = await getBooks(user.userId, tenantContext?.tenantId || null);

  return books.map((book) => ({
    id: book.id,
    title: book.title,
  }));
}

export const getStudentBooksAction = withErrorHandling(_getStudentBooks);
