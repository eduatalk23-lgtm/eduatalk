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
import { getFormString, getFormInt, getFormUuid } from "@/lib/utils/formDataHelpers";
import type {
  InternalScore,
  MockScore,
  GetMockScoresFilter,
  ScoreActionResult,
} from "./types";

// ============================================
// 내신 성적 Actions
// ============================================
// 레거시 Actions는 제거되었습니다. app/actions/scores-internal.ts의 함수들을 사용하세요.

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
  school: InternalScore[];
  mock: MockScore[];
}> {
  return service.getScoreTrendBySubject(studentId, subjectGroupId, tenantId);
}
