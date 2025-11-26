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
import * as service from "./service";
import {
  parseFormString,
  parseFormNumberOrNull,
} from "@/lib/utils/formData";
import type {
  SchoolScore,
  MockScore,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  ScoreActionResult,
} from "./types";

// ============================================
// 내신 성적 Actions
// ============================================

/**
 * 내신 성적 목록 조회
 */
export async function getSchoolScoresAction(
  studentId: string,
  tenantId?: string | null,
  filters?: GetSchoolScoresFilter
): Promise<SchoolScore[]> {
  return service.getSchoolScores(studentId, tenantId, filters);
}

/**
 * 내신 성적 단건 조회
 */
export async function getSchoolScoreByIdAction(
  scoreId: string,
  studentId: string
): Promise<SchoolScore | null> {
  return service.getSchoolScoreById(scoreId, studentId);
}

/**
 * 내신 성적 생성
 */
export async function createSchoolScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const input = {
    tenant_id: parseFormString(formData.get("tenant_id")) || null,
    student_id: parseFormString(formData.get("student_id")) || user.id,
    grade: parseFormNumberOrNull(formData.get("grade")) || 1,
    semester: parseFormNumberOrNull(formData.get("semester")) || 1,
    subject_group_id: parseFormString(formData.get("subject_group_id")) || null,
    subject_id: parseFormString(formData.get("subject_id")) || null,
    subject_type_id: parseFormString(formData.get("subject_type_id")) || null,
    subject_group: parseFormString(formData.get("subject_group")) || null,
    subject_type: parseFormString(formData.get("subject_type")) || null,
    subject_name: parseFormString(formData.get("subject_name")) || null,
    credit_hours: parseFormNumberOrNull(formData.get("credit_hours")),
    raw_score: parseFormNumberOrNull(formData.get("raw_score")),
    subject_average: parseFormNumberOrNull(formData.get("subject_average")),
    standard_deviation: parseFormNumberOrNull(formData.get("standard_deviation")),
    grade_score: parseFormNumberOrNull(formData.get("grade_score")),
    total_students: parseFormNumberOrNull(formData.get("total_students")),
    rank_grade: parseFormNumberOrNull(formData.get("rank_grade")),
  };

  const result = await service.createSchoolScore(input);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 내신 성적 수정
 */
export async function updateSchoolScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const scoreId = parseFormString(formData.get("id"));
  const studentId = parseFormString(formData.get("student_id")) || user.id;

  if (!scoreId) {
    return { success: false, error: "성적 ID가 필요합니다." };
  }

  const updates = {
    grade: parseFormNumberOrNull(formData.get("grade")) || undefined,
    semester: parseFormNumberOrNull(formData.get("semester")) || undefined,
    subject_group_id: parseFormString(formData.get("subject_group_id")) || undefined,
    subject_id: parseFormString(formData.get("subject_id")) || undefined,
    subject_type_id: parseFormString(formData.get("subject_type_id")) || undefined,
    subject_group: parseFormString(formData.get("subject_group")) || undefined,
    subject_type: parseFormString(formData.get("subject_type")) || undefined,
    subject_name: parseFormString(formData.get("subject_name")) || undefined,
    credit_hours: parseFormNumberOrNull(formData.get("credit_hours")),
    raw_score: parseFormNumberOrNull(formData.get("raw_score")),
    subject_average: parseFormNumberOrNull(formData.get("subject_average")),
    standard_deviation: parseFormNumberOrNull(formData.get("standard_deviation")),
    grade_score: parseFormNumberOrNull(formData.get("grade_score")),
    total_students: parseFormNumberOrNull(formData.get("total_students")),
    rank_grade: parseFormNumberOrNull(formData.get("rank_grade")),
  };

  const result = await service.updateSchoolScore(scoreId, studentId, updates);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 내신 성적 삭제
 */
export async function deleteSchoolScoreAction(
  scoreId: string,
  studentId?: string
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const targetStudentId = studentId || user.id;
  const result = await service.deleteSchoolScore(scoreId, targetStudentId);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

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

  const input = {
    tenant_id: parseFormString(formData.get("tenant_id")) || null,
    student_id: parseFormString(formData.get("student_id")) || user.id,
    grade: parseFormNumberOrNull(formData.get("grade")) || 1,
    exam_type: parseFormString(formData.get("exam_type")),
    subject_group_id: parseFormString(formData.get("subject_group_id")) || null,
    subject_id: parseFormString(formData.get("subject_id")) || null,
    subject_type_id: parseFormString(formData.get("subject_type_id")) || null,
    subject_group: parseFormString(formData.get("subject_group")) || null,
    subject_name: parseFormString(formData.get("subject_name")) || null,
    raw_score: parseFormNumberOrNull(formData.get("raw_score")),
    standard_score: parseFormNumberOrNull(formData.get("standard_score")),
    percentile: parseFormNumberOrNull(formData.get("percentile")),
    grade_score: parseFormNumberOrNull(formData.get("grade_score")),
    exam_round: parseFormString(formData.get("exam_round")) || null,
  };

  const result = await service.createMockScore(input);

  if (result.success) {
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

  const scoreId = parseFormString(formData.get("id"));
  const studentId = parseFormString(formData.get("student_id")) || user.id;

  if (!scoreId) {
    return { success: false, error: "성적 ID가 필요합니다." };
  }

  const updates = {
    grade: parseFormNumberOrNull(formData.get("grade")) || undefined,
    exam_type: parseFormString(formData.get("exam_type")) || undefined,
    subject_group_id: parseFormString(formData.get("subject_group_id")) || undefined,
    subject_id: parseFormString(formData.get("subject_id")) || undefined,
    subject_type_id: parseFormString(formData.get("subject_type_id")) || undefined,
    subject_group: parseFormString(formData.get("subject_group")) || undefined,
    subject_name: parseFormString(formData.get("subject_name")) || undefined,
    raw_score: parseFormNumberOrNull(formData.get("raw_score")),
    standard_score: parseFormNumberOrNull(formData.get("standard_score")),
    percentile: parseFormNumberOrNull(formData.get("percentile")),
    grade_score: parseFormNumberOrNull(formData.get("grade_score")),
    exam_round: parseFormString(formData.get("exam_round")) || undefined,
  };

  const result = await service.updateMockScore(scoreId, studentId, updates);

  if (result.success) {
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

  const targetStudentId = studentId || user.id;
  const result = await service.deleteMockScore(scoreId, targetStudentId);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
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
  school: SchoolScore[];
  mock: MockScore[];
}> {
  return service.getScoreTrendBySubject(studentId, subjectGroupId, tenantId);
}
