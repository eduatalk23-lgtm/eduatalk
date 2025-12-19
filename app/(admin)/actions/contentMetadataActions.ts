"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getCurriculumRevisions,
  createCurriculumRevision,
  updateCurriculumRevision,
  deleteCurriculumRevision,
  getSubjectCategories,
  createSubjectCategory,
  updateSubjectCategory,
  deleteSubjectCategory,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getPlatforms,
  createPlatform,
  updatePlatform,
  deletePlatform,
  getPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
} from "@/lib/data/contentMetadata";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// 개정교육과정
export const getCurriculumRevisionsAction = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getCurriculumRevisions();
});

export const createCurriculumRevisionAction = withErrorHandling(
  async (name: string, displayOrder?: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    // display_order가 제공되지 않으면 자동 계산
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const existingRevisions = await getCurriculumRevisions();
      finalDisplayOrder = existingRevisions.length > 0
        ? Math.max(...existingRevisions.map(r => r.display_order ?? 0)) + 1
        : 0;
    }
    return await createCurriculumRevision(name, finalDisplayOrder);
  }
);

export const updateCurriculumRevisionAction = withErrorHandling(
  async (
    id: string,
    updates: Partial<{ name: string; display_order: number; is_active: boolean }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updateCurriculumRevision(id, updates);
  }
);

export const deleteCurriculumRevisionAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await deleteCurriculumRevision(id);
});

// 교과 (Deprecated: getSubjectGroupsAction 사용 권장)
/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectGroupsAction을 사용하세요.
 */
export const getSubjectCategoriesAction = withErrorHandling(async (revisionId?: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  // subject_groups로 변환하여 반환 (하위 호환성)
  const { getSubjectGroupsAction } = await import("./subjectActions");
  const groups = await getSubjectGroupsAction(revisionId);
  
  // SubjectCategory 형태로 변환
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    display_order: group.display_order ?? 0,
    is_active: true,
  }));
});

export const createSubjectCategoryAction = withErrorHandling(
  async (revision_id: string, name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await createSubjectCategory(revision_id, name, display_order);
  }
);

export const updateSubjectCategoryAction = withErrorHandling(
  async (
    id: string,
    updates: Partial<{ name: string; display_order: number; is_active: boolean }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updateSubjectCategory(id, updates);
  }
);

export const deleteSubjectCategoryAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await deleteSubjectCategory(id);
});

// 과목 (Deprecated: getSubjectsByGroupAction 사용 권장)
/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectsByGroupAction을 사용하세요.
 */
export const getSubjectsAction = withErrorHandling(async (subjectCategoryId?: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  if (!subjectCategoryId) {
    return [];
  }

  // getSubjectsByGroupAction 사용
  const { getSubjectsByGroupAction } = await import("./subjectActions");
  const subjects = await getSubjectsByGroupAction(subjectCategoryId);
  
  // Subject 형태로 변환
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    subject_category_id: subject.subject_group_id,
    display_order: (subject as any).display_order ?? 0,
    is_active: true,
  }));
});

export const createSubjectAction = withErrorHandling(
  async (subject_category_id: string, name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await createSubject(subject_category_id, name, display_order);
  }
);

export const updateSubjectAction = withErrorHandling(
  async (id: string, updates: Partial<{ name: string; display_order: number; is_active: boolean }>) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updateSubject(id, updates);
  }
);

export const deleteSubjectAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await deleteSubject(id);
});

// 플랫폼
export const getPlatformsAction = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getPlatforms();
});

export const createPlatformAction = withErrorHandling(
  async (name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await createPlatform(name, display_order);
  }
);

export const updatePlatformAction = withErrorHandling(
  async (id: string, updates: Partial<{ name: string; display_order: number; is_active: boolean }>) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updatePlatform(id, updates);
  }
);

export const deletePlatformAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await deletePlatform(id);
});

// 출판사
export const getPublishersAction = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getPublishers();
});

export const createPublisherAction = withErrorHandling(
  async (name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await createPublisher(name, display_order);
  }
);

export const updatePublisherAction = withErrorHandling(
  async (id: string, updates: Partial<{ name: string; display_order: number; is_active: boolean }>) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updatePublisher(id, updates);
  }
);

export const deletePublisherAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await deletePublisher(id);
});

