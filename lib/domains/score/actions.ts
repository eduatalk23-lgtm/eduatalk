"use server";

/**
 * Score 도메인 Server Actions
 *
 * 기존 분산된 score 관련 actions를 통합합니다:
 * - app/actions/scores.ts
 * - app/(student)/actions/scoreActions.ts
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { recordHistory } from "@/lib/history/record";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSchoolScoreSchema,
  updateSchoolScoreSchema,
  createMockScoreSchema,
  updateMockScoreSchema,
} from "./validation";
import {
  getSchoolScores as getSchoolScoresQuery,
  getMockScores as getMockScoresQuery,
  getSchoolScoreById as getSchoolScoreByIdQuery,
  getMockScoreById as getMockScoreByIdQuery,
  createSchoolScore as createSchoolScoreQuery,
  updateSchoolScore as updateSchoolScoreQuery,
  deleteSchoolScore as deleteSchoolScoreQuery,
  createMockScore as createMockScoreQuery,
  updateMockScore as updateMockScoreQuery,
  deleteMockScore as deleteMockScoreQuery,
} from "./queries";
import type {
  SchoolScore,
  MockScore,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  ScoreActionResult,
} from "./types";

// ============================================
// 헬퍼 함수
// ============================================

function parseFormNumber(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function parseFormString(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseFormStringOrNull(value: FormDataEntryValue | null): string | null {
  const str = parseFormString(value);
  return str || null;
}

async function requireStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }
  return user;
}

async function requireTenant() {
  const context = await getTenantContext();
  if (!context?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }
  return context;
}

// ============================================
// 조회 Actions
// ============================================

export async function getSchoolScoresAction(
  filters?: GetSchoolScoresFilter
): Promise<SchoolScore[]> {
  const user = await requireStudent();
  const context = await getTenantContext();
  
  return getSchoolScoresQuery(user.userId, context?.tenantId, filters);
}

export async function getMockScoresAction(
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  const user = await requireStudent();
  const context = await getTenantContext();
  
  return getMockScoresQuery(user.userId, context?.tenantId, filters);
}

export async function getSchoolScoreByIdAction(
  scoreId: string
): Promise<SchoolScore | null> {
  const user = await requireStudent();
  return getSchoolScoreByIdQuery(scoreId, user.userId);
}

export async function getMockScoreByIdAction(
  scoreId: string
): Promise<MockScore | null> {
  const user = await requireStudent();
  return getMockScoreByIdQuery(scoreId, user.userId);
}

// ============================================
// 내신 성적 Actions
// ============================================

/**
 * 내신 성적 등록
 */
export async function addSchoolScoreAction(formData: FormData): Promise<void> {
  const user = await requireStudent();
  const context = await requireTenant();

  const rawData = {
    grade: parseFormNumber(formData.get("grade")),
    semester: parseFormNumber(formData.get("semester")),
    subject_group_id: parseFormStringOrNull(formData.get("subject_group_id")),
    subject_id: parseFormStringOrNull(formData.get("subject_id")),
    subject_type_id: parseFormStringOrNull(formData.get("subject_type_id")),
    subject_group: parseFormStringOrNull(formData.get("subject_group")),
    subject_type: parseFormStringOrNull(formData.get("subject_type")),
    subject_name: parseFormStringOrNull(formData.get("subject_name")),
    credit_hours: parseFormNumber(formData.get("credit_hours")),
    raw_score: parseFormNumber(formData.get("raw_score")),
    subject_average: parseFormNumber(formData.get("subject_average")),
    standard_deviation: parseFormNumber(formData.get("standard_deviation")),
    grade_score: parseFormNumber(formData.get("grade_score")),
    total_students: parseFormNumber(formData.get("total_students")),
    rank_grade: parseFormNumber(formData.get("rank_grade")),
  };

  const validation = createSchoolScoreSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new Error(firstError?.message || "입력값이 올바르지 않습니다.");
  }

  const result = await createSchoolScoreQuery({
    tenant_id: context.tenantId,
    student_id: user.userId,
    ...validation.data,
  });

  if (!result.success) {
    throw new Error(result.error || "내신 성적 등록에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(
    supabase,
    user.userId,
    "score_added",
    {
      score_type: "school",
      grade: validation.data.grade,
      semester: validation.data.semester,
      subject_group: validation.data.subject_group,
      subject_name: validation.data.subject_name,
      grade_score: validation.data.grade_score,
    },
    context.tenantId
  );

  const skipRedirect = formData.get("skipRedirect") === "true";
  if (!skipRedirect) {
    revalidatePath(`/scores/school/${validation.data.grade}/${validation.data.semester}`);
    redirect(`/scores/school/${validation.data.grade}/${validation.data.semester}?success=created`);
  } else {
    revalidatePath(`/scores/school/${validation.data.grade}/${validation.data.semester}`);
  }
}

/**
 * 내신 성적 수정
 */
export async function updateSchoolScoreAction(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await requireStudent();

  const rawData = {
    grade: parseFormNumber(formData.get("grade")),
    semester: parseFormNumber(formData.get("semester")),
    subject_group_id: parseFormStringOrNull(formData.get("subject_group_id")),
    subject_id: parseFormStringOrNull(formData.get("subject_id")),
    subject_type_id: parseFormStringOrNull(formData.get("subject_type_id")),
    subject_group: parseFormStringOrNull(formData.get("subject_group")),
    subject_type: parseFormStringOrNull(formData.get("subject_type")),
    subject_name: parseFormStringOrNull(formData.get("subject_name")),
    credit_hours: parseFormNumber(formData.get("credit_hours")),
    raw_score: parseFormNumber(formData.get("raw_score")),
    subject_average: parseFormNumber(formData.get("subject_average")),
    standard_deviation: parseFormNumber(formData.get("standard_deviation")),
    grade_score: parseFormNumber(formData.get("grade_score")),
    total_students: parseFormNumber(formData.get("total_students")),
    rank_grade: parseFormNumber(formData.get("rank_grade")),
  };

  const validation = updateSchoolScoreSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new Error(firstError?.message || "입력값이 올바르지 않습니다.");
  }

  const result = await updateSchoolScoreQuery(id, user.userId, validation.data);

  if (!result.success) {
    throw new Error(result.error || "내신 성적 수정에 실패했습니다.");
  }

  const skipRedirect = formData.get("skipRedirect") === "true";
  if (!skipRedirect && validation.data.grade && validation.data.semester) {
    revalidatePath(`/scores/school/${validation.data.grade}/${validation.data.semester}`);
    redirect(`/scores/school/${validation.data.grade}/${validation.data.semester}?success=updated`);
  } else if (validation.data.grade && validation.data.semester) {
    revalidatePath(`/scores/school/${validation.data.grade}/${validation.data.semester}`);
  }
}

/**
 * 내신 성적 삭제
 */
export async function deleteSchoolScoreAction(
  id: string,
  options?: { skipRedirect?: boolean; grade?: number; semester?: number }
): Promise<void> {
  const user = await requireStudent();

  const result = await deleteSchoolScoreQuery(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "내신 성적 삭제에 실패했습니다.");
  }

  if (options?.skipRedirect && options.grade && options.semester) {
    revalidatePath(`/scores/school/${options.grade}/${options.semester}`);
    return;
  }

  revalidatePath("/scores");
  if (!options?.skipRedirect) {
    redirect("/scores");
  }
}

// ============================================
// 모의고사 성적 Actions
// ============================================

/**
 * 모의고사 성적 등록
 */
export async function addMockScoreAction(formData: FormData): Promise<void> {
  const user = await requireStudent();
  const context = await requireTenant();

  const rawData = {
    grade: parseFormNumber(formData.get("grade")),
    exam_type: parseFormString(formData.get("exam_type")),
    subject_group_id: parseFormStringOrNull(formData.get("subject_group_id")),
    subject_id: parseFormStringOrNull(formData.get("subject_id")),
    subject_type_id: parseFormStringOrNull(formData.get("subject_type_id")),
    subject_group: parseFormStringOrNull(formData.get("subject_group")),
    subject_name: parseFormStringOrNull(formData.get("subject_name")),
    raw_score: parseFormNumber(formData.get("raw_score")),
    standard_score: parseFormNumber(formData.get("standard_score")),
    percentile: parseFormNumber(formData.get("percentile")),
    grade_score: parseFormNumber(formData.get("grade_score")),
    exam_round: parseFormStringOrNull(formData.get("exam_round")),
  };

  const validation = createMockScoreSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new Error(firstError?.message || "입력값이 올바르지 않습니다.");
  }

  // 영어/한국사가 아닌 경우 표준점수, 백분위 필수
  const subjectGroup = validation.data.subject_group || "";
  const isEnglishOrKoreanHistory = subjectGroup === "영어" || subjectGroup === "한국사";
  
  if (!isEnglishOrKoreanHistory) {
    if (!validation.data.standard_score || !validation.data.percentile) {
      throw new Error("표준점수와 백분위를 모두 입력해주세요.");
    }
  }

  const result = await createMockScoreQuery({
    tenant_id: context.tenantId,
    student_id: user.userId,
    ...validation.data,
  });

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 등록에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(
    supabase,
    user.userId,
    "score_added",
    {
      score_type: "mock",
      grade: validation.data.grade,
      exam_type: validation.data.exam_type,
      subject_group: validation.data.subject_group,
      subject_name: validation.data.subject_name,
      grade_score: validation.data.grade_score,
    },
    context.tenantId
  );

  const skipRedirect = formData.get("skipRedirect") === "true";
  const month = validation.data.exam_round || "3";
  const examType = encodeURIComponent(validation.data.exam_type);

  if (skipRedirect) {
    revalidatePath(`/scores/mock/${validation.data.grade}/${month}/${examType}`);
  } else {
    revalidatePath(`/scores/mock/${validation.data.grade}/${month}/${examType}`);
    redirect(`/scores/mock/${validation.data.grade}/${month}/${examType}?success=created`);
  }
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScoreAction(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await requireStudent();

  const rawData = {
    grade: parseFormNumber(formData.get("grade")),
    exam_type: parseFormString(formData.get("exam_type")),
    subject_group_id: parseFormStringOrNull(formData.get("subject_group_id")),
    subject_id: parseFormStringOrNull(formData.get("subject_id")),
    subject_type_id: parseFormStringOrNull(formData.get("subject_type_id")),
    subject_group: parseFormStringOrNull(formData.get("subject_group")),
    subject_name: parseFormStringOrNull(formData.get("subject_name")),
    raw_score: parseFormNumber(formData.get("raw_score")),
    standard_score: parseFormNumber(formData.get("standard_score")),
    percentile: parseFormNumber(formData.get("percentile")),
    grade_score: parseFormNumber(formData.get("grade_score")),
    exam_round: parseFormStringOrNull(formData.get("exam_round")),
  };

  const validation = updateMockScoreSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new Error(firstError?.message || "입력값이 올바르지 않습니다.");
  }

  const result = await updateMockScoreQuery(id, user.userId, validation.data);

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 수정에 실패했습니다.");
  }

  const skipRedirect = formData.get("skipRedirect") === "true";
  if (validation.data.grade && validation.data.exam_type) {
    const month = validation.data.exam_round || "3";
    const examType = encodeURIComponent(validation.data.exam_type);
    
    revalidatePath(`/scores/mock/${validation.data.grade}/${month}/${examType}`);
    
    if (!skipRedirect) {
      redirect(`/scores/mock/${validation.data.grade}/${month}/${examType}?success=updated`);
    }
  }
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScoreAction(id: string): Promise<void> {
  const user = await requireStudent();

  const result = await deleteMockScoreQuery(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 삭제에 실패했습니다.");
  }

  revalidatePath("/scores/mock");
}

