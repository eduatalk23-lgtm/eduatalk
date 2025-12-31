"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getCurriculumRevisions,
  createCurriculumRevision,
  updateCurriculumRevision,
  deleteCurriculumRevision,
  createSubjectCategory,
  updateSubjectCategory,
  deleteSubjectCategory,
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

// ============================================
// DEPRECATED: SubjectCategory 관련 액션
// ============================================
// 
// 다음 액션들은 deprecated되었습니다.
// 대신 @app/(admin)/actions/subjectActions.ts의 다음 액션들을 사용하세요:
// - getSubjectGroupsAction (getSubjectCategoriesAction 대체)
// - createSubjectGroup (createSubjectCategoryAction 대체)
// - updateSubjectGroup (updateSubjectCategoryAction 대체)
// - deleteSubjectGroup (deleteSubjectCategoryAction 대체)
//
// @deprecated Use getSubjectGroupsAction from @app/(admin)/actions/subjectActions.ts
// @deprecated Use createSubjectGroup from @app/(admin)/actions/subjectActions.ts
// @deprecated Use updateSubjectGroup from @app/(admin)/actions/subjectActions.ts
// @deprecated Use deleteSubjectGroup from @app/(admin)/actions/subjectActions.ts

/**
 * @deprecated Use createSubjectGroup from @app/(admin)/actions/subjectActions.ts
 */
export const createSubjectCategoryAction = withErrorHandling(
  async (revision_id: string, name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    console.warn(
      "[DEPRECATED] createSubjectCategoryAction is deprecated. Use createSubjectGroup from @app/(admin)/actions/subjectActions.ts instead."
    );
    return await createSubjectCategory(revision_id, name, display_order);
  }
);

/**
 * @deprecated Use updateSubjectGroup from @app/(admin)/actions/subjectActions.ts
 */
export const updateSubjectCategoryAction = withErrorHandling(
  async (
    id: string,
    updates: Partial<{ name: string; display_order: number; is_active: boolean }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    console.warn(
      "[DEPRECATED] updateSubjectCategoryAction is deprecated. Use updateSubjectGroup from @app/(admin)/actions/subjectActions.ts instead."
    );
    return await updateSubjectCategory(id, updates);
  }
);

/**
 * @deprecated Use deleteSubjectGroup from @app/(admin)/actions/subjectActions.ts
 */
export const deleteSubjectCategoryAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  console.warn(
    "[DEPRECATED] deleteSubjectCategoryAction is deprecated. Use deleteSubjectGroup from @app/(admin)/actions/subjectActions.ts instead."
  );
  return await deleteSubjectCategory(id);
});

// ============================================
// DEPRECATED: Subject 관련 액션 (subject_category_id 사용)
// ============================================
// 
// 다음 액션들은 deprecated되었습니다.
// 대신 @app/(admin)/actions/subjectActions.ts의 다음 액션들을 사용하세요:
// - getSubjectsByGroupAction (getSubjectsAction 대체)
// - createSubject (subject_group_id 사용)
// - updateSubject (subject_group_id 사용)
// - deleteSubject
//
// @deprecated Use getSubjectsByGroupAction from @app/(admin)/actions/subjectActions.ts
// @deprecated Use createSubject from @app/(admin)/actions/subjectActions.ts (subject_group_id 사용)
// @deprecated Use updateSubject from @app/(admin)/actions/subjectActions.ts (subject_group_id 사용)

/**
 * @deprecated Use createSubject from @app/(admin)/actions/subjectActions.ts (subject_group_id 사용)
 */
export const createSubjectAction = withErrorHandling(
  async (subject_category_id: string, name: string, display_order: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    console.warn(
      "[DEPRECATED] createSubjectAction with subject_category_id is deprecated. Use createSubject from @app/(admin)/actions/subjectActions.ts with subject_group_id instead."
    );
    return await createSubject(subject_category_id, name, display_order);
  }
);

/**
 * @deprecated Use updateSubject from @app/(admin)/actions/subjectActions.ts
 */
export const updateSubjectAction = withErrorHandling(
  async (id: string, updates: Partial<{ name: string; display_order: number; is_active: boolean }>) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    console.warn(
      "[DEPRECATED] updateSubjectAction is deprecated. Use updateSubject from @app/(admin)/actions/subjectActions.ts instead."
    );
    return await updateSubject(id, updates);
  }
);

/**
 * @deprecated Use deleteSubject from @app/(admin)/actions/subjectActions.ts
 */
export const deleteSubjectAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  console.warn(
    "[DEPRECATED] deleteSubjectAction is deprecated. Use deleteSubject from @app/(admin)/actions/subjectActions.ts instead."
  );
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

