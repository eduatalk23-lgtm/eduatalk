"use server";

/**
 * Score 도메인 Server Actions
 *
 * 이 파일은 Server Actions만 담당합니다.
 * - 권한 검사
 * - FormData 파싱
 * - Service 호출
 * - Cache 무효화
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { calculateSchoolYear } from "@/lib/data/studentTerms";
import {
  createInternalScore as createInternalScoreData,
  updateInternalScore as updateInternalScoreData,
  deleteInternalScore as deleteInternalScoreData,
  deleteMockScore as deleteMockScoreData,
  createInternalScoresBatch as createInternalScoresBatchData,
  createMockScoresBatch as createMockScoresBatchData,
} from "@/lib/data/studentScores";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import * as service from "../service";
import { getFormString, getFormInt, getFormUuid } from "@/lib/utils/formDataHelpers";
import type {
  InternalScore,
  MockScore,
  GetMockScoresFilter,
  ScoreActionResult,
} from "../types";
import { recalculateRiskIndex } from "@/lib/domains/analysis/actions/riskIndex";
import {
  computeScoreAnalysis,
  determineSubjectCategory,
  determineGradeSystem,
} from "../computation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 산출값 계산에 필요한 메타데이터(subject_type is_achievement_only, curriculum year) 조회
 */
async function fetchComputationMeta(
  curriculumRevisionId: string,
  subjectTypeIds: string[]
): Promise<{
  curriculumYear: number | null;
  subjectTypeMap: Map<string, boolean>;
}> {
  const supabase = await createSupabaseServerClient();

  // curriculum year 조회
  const { data: curriculum } = await supabase
    .from("curriculum_revisions")
    .select("year")
    .eq("id", curriculumRevisionId)
    .maybeSingle();

  // subject_types의 is_achievement_only 조회
  const uniqueIds = [...new Set(subjectTypeIds)];
  const subjectTypeMap = new Map<string, boolean>();

  if (uniqueIds.length > 0) {
    const { data: types } = await supabase
      .from("subject_types")
      .select("id, is_achievement_only")
      .in("id", uniqueIds);

    for (const t of types ?? []) {
      subjectTypeMap.set(t.id, t.is_achievement_only);
    }
  }

  return {
    curriculumYear: curriculum?.year ?? null,
    subjectTypeMap,
  };
}

/**
 * 단일 성적 레코드에 대해 산출값을 계산하여 반환
 */
function computeFieldsForScore(
  score: {
    raw_score?: number | null;
    avg_score?: number | null;
    std_dev?: number | null;
    rank_grade?: number | null;
    achievement_level?: string | null;
    achievement_ratio_a?: number | null;
    achievement_ratio_b?: number | null;
    achievement_ratio_c?: number | null;
    achievement_ratio_d?: number | null;
    achievement_ratio_e?: number | null;
    total_students?: number | null;
    class_rank?: number | null;
    subject_type_id?: string;
  },
  subjectTypeMap: Map<string, boolean>,
  curriculumYear: number | null
): {
  estimated_percentile: number | null;
  estimated_std_dev: number | null;
  converted_grade_9: number | null;
  adjusted_grade: number | null;
} {
  const isAchievementOnly = score.subject_type_id
    ? (subjectTypeMap.get(score.subject_type_id) ?? false)
    : false;

  const computed = computeScoreAnalysis({
    rawScore: score.raw_score ?? null,
    avgScore: score.avg_score ?? null,
    stdDev: score.std_dev ?? null,
    rankGrade: score.rank_grade ?? null,
    achievementLevel: score.achievement_level ?? null,
    ratioA: score.achievement_ratio_a ?? null,
    ratioB: score.achievement_ratio_b ?? null,
    ratioC: score.achievement_ratio_c ?? null,
    ratioD: score.achievement_ratio_d ?? null,
    ratioE: score.achievement_ratio_e ?? null,
    totalStudents: score.total_students ?? null,
    classRank: score.class_rank ?? null,
    subjectCategory: determineSubjectCategory(
      isAchievementOnly,
      score.rank_grade ?? null,
      score.std_dev ?? null
    ),
    gradeSystem: determineGradeSystem(curriculumYear),
  });

  return {
    estimated_percentile: computed.estimatedPercentile,
    estimated_std_dev: computed.estimatedStdDev,
    converted_grade_9: computed.convertedGrade9,
    adjusted_grade: computed.adjustedGrade,
  };
}

/**
 * 성적 변경 후 위험도 분석을 비동기적으로 트리거 (fire and forget)
 * 실패해도 메인 작업에 영향을 주지 않음
 */
function triggerRiskAnalysis(studentId: string, tenantId?: string): void {
  recalculateRiskIndex({ studentId, tenantId }).catch((error) => {
    console.warn("[RiskAnalysis] 위험도 재계산 실패 (비동기):", error);
  });
}

// ============================================
// 내신 성적 Actions
// ============================================

/**
 * 내신 성적 생성
 */
async function _createInternalScore(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const school_year = formData.get("school_year") ? parseInt(formData.get("school_year") as string) : calculateSchoolYear();
  const grade = parseInt(formData.get("grade") as string);
  const semester = parseInt(formData.get("semester") as string);
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;
  const subject_group_id = formData.get("subject_group_id") as string;
  const subject_type_id = formData.get("subject_type_id") as string;
  const subject_id = formData.get("subject_id") as string;
  const credit_hours = parseFloat(formData.get("credit_hours") as string);
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : null;
  const avg_score = formData.get("avg_score") ? parseFloat(formData.get("avg_score") as string) : null;
  const std_dev = formData.get("std_dev") ? parseFloat(formData.get("std_dev") as string) : null;
  const rank_grade = formData.get("rank_grade") ? parseInt(formData.get("rank_grade") as string) : null;
  const total_students = formData.get("total_students") ? parseInt(formData.get("total_students") as string) : null;
  const achievement_level = formData.get("achievement_level") as string | null;
  const achievement_ratio_a = formData.get("achievement_ratio_a") ? parseFloat(formData.get("achievement_ratio_a") as string) : null;
  const achievement_ratio_b = formData.get("achievement_ratio_b") ? parseFloat(formData.get("achievement_ratio_b") as string) : null;
  const achievement_ratio_c = formData.get("achievement_ratio_c") ? parseFloat(formData.get("achievement_ratio_c") as string) : null;
  const achievement_ratio_d = formData.get("achievement_ratio_d") ? parseFloat(formData.get("achievement_ratio_d") as string) : null;
  const achievement_ratio_e = formData.get("achievement_ratio_e") ? parseFloat(formData.get("achievement_ratio_e") as string) : null;
  const class_rank = formData.get("class_rank") ? parseInt(formData.get("class_rank") as string) : null;

  // 필수 필드 검증
  if (!tenant_id) {
    throw new AppError("기관 정보를 찾을 수 없습니다. 학생 설정을 완료해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }
  if (!curriculum_revision_id || !subject_group_id || !subject_type_id || !subject_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!grade || !semester || !credit_hours) {
    throw new AppError("학년, 학기, 이수단위는 필수입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 산출값 계산
  const { curriculumYear, subjectTypeMap } = await fetchComputationMeta(
    curriculum_revision_id,
    [subject_type_id]
  );
  const computedFields = computeFieldsForScore(
    {
      raw_score, avg_score, std_dev, rank_grade,
      achievement_level, achievement_ratio_a, achievement_ratio_b,
      achievement_ratio_c, achievement_ratio_d, achievement_ratio_e,
      total_students, class_rank, subject_type_id,
    },
    subjectTypeMap,
    curriculumYear
  );

  // lib/data/studentScores.ts의 createInternalScore 사용
  const result = await createInternalScoreData({
    tenant_id,
    student_id,
    curriculum_revision_id,
    subject_group_id,
    subject_type_id,
    subject_id,
    grade,
    semester,
    credit_hours,
    raw_score,
    avg_score,
    std_dev,
    rank_grade,
    total_students,
    achievement_level,
    achievement_ratio_a,
    achievement_ratio_b,
    achievement_ratio_c,
    achievement_ratio_d,
    achievement_ratio_e,
    class_rank,
    school_year,
    ...computedFields,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 위험도 분석 비동기 트리거
  triggerRiskAnalysis(student_id, tenant_id);

  revalidatePath("/scores");
  return { success: true, scoreId: result.scoreId };
}

export const createInternalScore = withActionResponse(_createInternalScore);

/**
 * 내신 성적 수정
 */
async function _updateInternalScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const tenant_id = user.tenantId || (formData.get("tenant_id") as string);
  const grade = formData.get("grade") ? parseInt(formData.get("grade") as string) : undefined;
  const semester = formData.get("semester") ? parseInt(formData.get("semester") as string) : undefined;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string | undefined;
  const subject_group_id = formData.get("subject_group_id") as string | undefined;
  const subject_type_id = formData.get("subject_type_id") as string | undefined;
  const subject_id = formData.get("subject_id") as string | undefined;
  const credit_hours = formData.get("credit_hours") ? parseFloat(formData.get("credit_hours") as string) : undefined;
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : undefined;
  const avg_score = formData.get("avg_score") ? parseFloat(formData.get("avg_score") as string) : undefined;
  const std_dev = formData.get("std_dev") ? parseFloat(formData.get("std_dev") as string) : undefined;
  const rank_grade = formData.get("rank_grade") ? parseInt(formData.get("rank_grade") as string) : undefined;
  const total_students = formData.get("total_students") ? parseInt(formData.get("total_students") as string) : undefined;
  const achievement_level = formData.has("achievement_level") ? (formData.get("achievement_level") as string || null) : undefined;
  const achievement_ratio_a = formData.has("achievement_ratio_a") ? (formData.get("achievement_ratio_a") ? parseFloat(formData.get("achievement_ratio_a") as string) : null) : undefined;
  const achievement_ratio_b = formData.has("achievement_ratio_b") ? (formData.get("achievement_ratio_b") ? parseFloat(formData.get("achievement_ratio_b") as string) : null) : undefined;
  const achievement_ratio_c = formData.has("achievement_ratio_c") ? (formData.get("achievement_ratio_c") ? parseFloat(formData.get("achievement_ratio_c") as string) : null) : undefined;
  const achievement_ratio_d = formData.has("achievement_ratio_d") ? (formData.get("achievement_ratio_d") ? parseFloat(formData.get("achievement_ratio_d") as string) : null) : undefined;
  const achievement_ratio_e = formData.has("achievement_ratio_e") ? (formData.get("achievement_ratio_e") ? parseFloat(formData.get("achievement_ratio_e") as string) : null) : undefined;
  const class_rank = formData.has("class_rank") ? (formData.get("class_rank") ? parseInt(formData.get("class_rank") as string) : null) : undefined;

  if (!tenant_id) {
    throw new AppError("기관 정보를 찾을 수 없습니다. 학생 설정을 완료해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 업데이트할 필드만 구성
  const updates: Record<string, unknown> = {};
  if (grade !== undefined) updates.grade = grade;
  if (semester !== undefined) updates.semester = semester;
  if (curriculum_revision_id) updates.curriculum_revision_id = curriculum_revision_id;
  if (subject_group_id) updates.subject_group_id = subject_group_id;
  if (subject_type_id) updates.subject_type_id = subject_type_id;
  if (subject_id) updates.subject_id = subject_id;
  if (credit_hours !== undefined) updates.credit_hours = credit_hours;
  if (raw_score !== undefined) updates.raw_score = raw_score;
  if (avg_score !== undefined) updates.avg_score = avg_score;
  if (std_dev !== undefined) updates.std_dev = std_dev;
  if (rank_grade !== undefined) updates.rank_grade = rank_grade;
  if (total_students !== undefined) updates.total_students = total_students;
  if (achievement_level !== undefined) updates.achievement_level = achievement_level;
  if (achievement_ratio_a !== undefined) updates.achievement_ratio_a = achievement_ratio_a;
  if (achievement_ratio_b !== undefined) updates.achievement_ratio_b = achievement_ratio_b;
  if (achievement_ratio_c !== undefined) updates.achievement_ratio_c = achievement_ratio_c;
  if (achievement_ratio_d !== undefined) updates.achievement_ratio_d = achievement_ratio_d;
  if (achievement_ratio_e !== undefined) updates.achievement_ratio_e = achievement_ratio_e;
  if (class_rank !== undefined) updates.class_rank = class_rank;

  // 산출값 재계산: 기존 레코드를 조회하여 병합 후 계산
  const supabaseForUpdate = await createSupabaseServerClient();
  const { data: existingScore } = await supabaseForUpdate
    .from("student_internal_scores")
    .select("raw_score, avg_score, std_dev, rank_grade, achievement_level, achievement_ratio_a, achievement_ratio_b, achievement_ratio_c, achievement_ratio_d, achievement_ratio_e, total_students, class_rank, subject_type_id, curriculum_revision_id")
    .eq("id", scoreId)
    .maybeSingle();

  if (existingScore) {
    const merged = { ...existingScore, ...updates };
    const curRevId = (curriculum_revision_id ?? existingScore.curriculum_revision_id) as string;
    const stId = (subject_type_id ?? existingScore.subject_type_id) as string;

    const { curriculumYear, subjectTypeMap } = await fetchComputationMeta(
      curRevId,
      [stId]
    );
    const computedFields = computeFieldsForScore(
      { ...merged, subject_type_id: stId },
      subjectTypeMap,
      curriculumYear
    );

    updates.estimated_percentile = computedFields.estimated_percentile;
    updates.estimated_std_dev = computedFields.estimated_std_dev;
    updates.converted_grade_9 = computedFields.converted_grade_9;
    updates.adjusted_grade = computedFields.adjusted_grade;
  }

  // lib/data/studentScores.ts의 updateInternalScore 사용
  const result = await updateInternalScoreData(scoreId, user.userId, tenant_id, updates);

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 위험도 분석 비동기 트리거
  triggerRiskAnalysis(user.userId, tenant_id);

  revalidatePath("/scores");
  revalidatePath(`/scores/${scoreId}/edit`);
  return { success: true };
}

export const updateInternalScore = withActionResponse(_updateInternalScore);

/**
 * 내신 성적 삭제
 *
 * 레코드에서 실제 student_id를 조회하여 삭제합니다.
 * admin이 호출해도 올바른 student_id로 삭제됩니다.
 */
async function _deleteInternalScore(scoreId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!user.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 레코드에서 실제 student_id를 조회 (admin이 호출할 때 user.userId ≠ student_id)
  const supabaseForLookup = await createSupabaseServerClient();
  const { data: scoreRecord } = await supabaseForLookup
    .from("student_internal_scores")
    .select("student_id")
    .eq("id", scoreId)
    .maybeSingle();

  const targetStudentId = scoreRecord?.student_id ?? user.userId;

  const result = await deleteInternalScoreData(scoreId, targetStudentId, user.tenantId);

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  triggerRiskAnalysis(targetStudentId, user.tenantId);

  revalidatePath("/scores");
  revalidatePath(`/admin/students/${targetStudentId}`);
  return { success: true };
}

export const deleteInternalScore = withActionResponse(_deleteInternalScore);

/**
 * 성적 삭제 (타입 자동 감지)
 *
 * 내신/모의 자동 감지 후 레코드의 student_id로 삭제합니다.
 */
async function _deleteScore(scoreId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!user.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 내신 테이블에서 먼저 조회
  const supabaseForLookup = await createSupabaseServerClient();
  const { data: internalScore } = await supabaseForLookup
    .from("student_internal_scores")
    .select("student_id")
    .eq("id", scoreId)
    .maybeSingle();

  if (internalScore) {
    const result = await deleteInternalScoreData(scoreId, internalScore.student_id, user.tenantId);
    if (!result.success) {
      throw new AppError(
        result.error || "내신 성적 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
    triggerRiskAnalysis(internalScore.student_id, user.tenantId);
  } else {
    // 모의고사 테이블에서 조회
    const { data: mockScore } = await supabaseForLookup
      .from("student_mock_scores")
      .select("student_id")
      .eq("id", scoreId)
      .maybeSingle();

    if (!mockScore) {
      throw new AppError("성적을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    const result = await deleteMockScoreData(scoreId, mockScore.student_id, user.tenantId);
    if (!result.success) {
      throw new AppError(
        result.error || "모의고사 성적 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
    triggerRiskAnalysis(mockScore.student_id, user.tenantId);
  }

  revalidatePath("/scores");
  return { success: true };
}

export const deleteScore = withActionResponse(_deleteScore);

/**
 * 내신 성적 일괄 생성
 */
async function _createInternalScoresBatch(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;
  const school_year = formData.get("school_year")
    ? parseInt(formData.get("school_year") as string)
    : calculateSchoolYear();

  // scores 배열 파싱 (JSON 문자열)
  const scoresJson = formData.get("scores") as string;
  if (!scoresJson) {
    throw new AppError("성적 데이터가 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const scores: Array<{
    subject_group_id: string;
    subject_id: string;
    subject_type_id: string;
    grade: number;
    semester: number;
    credit_hours: number;
    rank_grade: number | null;
    raw_score?: number | null;
    avg_score?: number | null;
    std_dev?: number | null;
    total_students?: number | null;
    achievement_level?: string | null;
    achievement_ratio_a?: number | null;
    achievement_ratio_b?: number | null;
    achievement_ratio_c?: number | null;
    achievement_ratio_d?: number | null;
    achievement_ratio_e?: number | null;
    class_rank?: number | null;
  }> = JSON.parse(scoresJson);

  // 필수 필드 검증
  if (!student_id || !tenant_id || !curriculum_revision_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 산출값 계산을 위한 메타데이터 조회
  const { curriculumYear, subjectTypeMap } = await fetchComputationMeta(
    curriculum_revision_id,
    scores.map((s) => s.subject_type_id)
  );

  // 각 성적에 산출값 추가
  const enrichedScores = scores.map((score) => {
    const computed = computeFieldsForScore(score, subjectTypeMap, curriculumYear);
    return { ...score, ...computed };
  });

  // lib/data/studentScores.ts의 createInternalScoresBatch 사용
  const result = await createInternalScoresBatchData(enrichedScores, {
    tenant_id,
    student_id,
    curriculum_revision_id,
    school_year,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 위험도 분석 비동기 트리거
  triggerRiskAnalysis(student_id, tenant_id);

  revalidatePath("/scores");
  revalidatePath(`/admin/students/${student_id}`);
  return { success: true, scores: result.scores };
}

export const createInternalScoresBatch = withActionResponse(_createInternalScoresBatch);

/**
 * 모의고사 성적 일괄 생성
 */
async function _createMockScoresBatch(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;

  // scores 배열 파싱 (JSON 문자열)
  const scoresJson = formData.get("scores") as string;
  if (!scoresJson) {
    throw new AppError("성적 데이터가 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const scores: Array<{
    exam_date: string;
    exam_title: string;
    grade: number;
    subject_id: string;
    subject_group_id: string;
    grade_score: number;
    standard_score?: number | null;
    percentile?: number | null;
    raw_score?: number | null;
  }> = JSON.parse(scoresJson);

  // 필수 필드 검증
  if (!student_id || !tenant_id || !curriculum_revision_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 createMockScoresBatch 사용
  const result = await createMockScoresBatchData(scores, {
    tenant_id,
    student_id,
    curriculum_revision_id,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "모의고사 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 위험도 분석 비동기 트리거
  triggerRiskAnalysis(student_id, tenant_id);

  revalidatePath("/scores");
  return { success: true, scores: result.scores };
}

export const createMockScoresBatch = withActionResponse(_createMockScoresBatch);

// ============================================
// 모의고사 성적 Actions
// ============================================

/**
 * 모의고사 성적 목록 조회
 */
export async function getMockScoresAction(
  studentId: string,
  tenantId?: string | null,
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  return service.getMockScores(studentId, tenantId, filters);
}

/**
 * 모의고사 성적 단건 조회
 */
export async function getMockScoreByIdAction(
  scoreId: string,
  studentId: string
): Promise<MockScore | null> {
  return service.getMockScoreById(scoreId, studentId);
}

/**
 * 모의고사 성적 생성
 */
export async function createMockScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // exam_date와 exam_title 가져오기
  const examDate =
    getFormString(formData, "exam_date") ||
    new Date().toISOString().split("T")[0];
  const examTitle =
    getFormString(formData, "exam_title") ||
    getFormString(formData, "exam_type") ||
    "모의고사";

  // curriculum_revision_id 가져오기
  const { getActiveCurriculumRevision } = await import("@/lib/data/subjects");
  const curriculumRevision = await getActiveCurriculumRevision();
  if (!curriculumRevision) {
    return {
      success: false,
      error: "개정교육과정을 찾을 수 없습니다. 관리자에게 문의해주세요.",
    };
  }

  const input = {
    tenant_id: getFormString(formData, "tenant_id") || user.tenantId || "",
    student_id: getFormString(formData, "student_id") || user.userId,
    exam_date: examDate,
    exam_title: examTitle,
    grade: getFormInt(formData, "grade") || 1,
    subject_id: getFormUuid(formData, "subject_id") || "",
    subject_group_id: getFormUuid(formData, "subject_group_id") || "",
    curriculum_revision_id: curriculumRevision.id,
    raw_score: getFormInt(formData, "raw_score"),
    standard_score: getFormInt(formData, "standard_score"),
    percentile: getFormInt(formData, "percentile"),
    grade_score: getFormInt(formData, "grade_score"),
    semester: getFormInt(formData, "semester") ?? undefined,
  };

  const result = await service.createMockScore(input);

  if (result.success) {
    // 위험도 분석 비동기 트리거
    triggerRiskAnalysis(input.student_id, input.tenant_id);
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const scoreId = getFormString(formData, "id");
  const studentId = getFormString(formData, "student_id") || user.userId;

  if (!scoreId) {
    return { success: false, error: "성적 ID가 필요합니다." };
  }

  const updates = {
    grade: getFormInt(formData, "grade") ?? undefined,
    exam_type: getFormString(formData, "exam_type") ?? undefined,
    subject_group_id: getFormUuid(formData, "subject_group_id") ?? undefined,
    subject_id: getFormUuid(formData, "subject_id") ?? undefined,
    subject_type_id: getFormUuid(formData, "subject_type_id") ?? undefined,
    subject_group: getFormString(formData, "subject_group") ?? undefined,
    subject_name: getFormString(formData, "subject_name") ?? undefined,
    raw_score: getFormInt(formData, "raw_score") ?? undefined,
    standard_score: getFormInt(formData, "standard_score") ?? undefined,
    percentile: getFormInt(formData, "percentile") ?? undefined,
    grade_score: getFormInt(formData, "grade_score") ?? undefined,
    exam_round: getFormString(formData, "exam_round") ?? undefined,
  };

  const result = await service.updateMockScore(scoreId, studentId, updates);

  if (result.success) {
    // 위험도 분석 비동기 트리거
    triggerRiskAnalysis(studentId, user.tenantId ?? undefined);
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScoreAction(
  scoreId: string,
  studentId?: string
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const targetStudentId = studentId || user.userId;
  const result = await service.deleteMockScore(scoreId, targetStudentId);

  if (result.success) {
    // 위험도 분석 비동기 트리거
    triggerRiskAnalysis(targetStudentId, user.tenantId ?? undefined);
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

// ============================================
// Admin 전용 Actions (studentId를 파라미터로 받음)
// ============================================

/**
 * Admin용 내신 성적 삭제 (studentId 지정 가능)
 */
export async function adminDeleteInternalScore(
  scoreId: string,
  studentId: string,
  tenantId: string
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const result = await deleteInternalScoreData(scoreId, studentId, tenantId);

  if (!result.success) {
    return { success: false, error: result.error || "내신 성적 삭제에 실패했습니다." };
  }

  triggerRiskAnalysis(studentId, tenantId);
  revalidatePath("/scores");
  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

/**
 * Admin용 모의고사 성적 삭제 (studentId 지정 가능)
 */
export async function adminDeleteMockScore(
  scoreId: string,
  studentId: string,
  tenantId: string
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const result = await deleteMockScoreData(scoreId, studentId, tenantId);

  if (!result.success) {
    return { success: false, error: result.error || "모의고사 성적 삭제에 실패했습니다." };
  }

  triggerRiskAnalysis(studentId, tenantId);
  revalidatePath("/scores");
  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}

// ============================================
// 비즈니스 로직 Actions
// ============================================

/**
 * 평균 등급 조회
 */
export async function getAverageGradeAction(
  studentId: string,
  tenantId?: string | null
): Promise<{ schoolAvg: number | null; mockAvg: number | null }> {
  return service.calculateAverageGrade(studentId, tenantId);
}

/**
 * 과목별 성적 추이 조회
 */
export async function getScoreTrendAction(
  studentId: string,
  subjectGroupId: string,
  tenantId?: string | null
): Promise<{
  school: InternalScore[];
  mock: MockScore[];
}> {
  return service.getScoreTrendBySubject(studentId, subjectGroupId, tenantId);
}
