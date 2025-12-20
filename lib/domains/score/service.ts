/**
 * Score 도메인 Service
 *
 * 이 파일은 비즈니스 로직을 담당합니다.
 * - 데이터 변환 및 가공
 * - 비즈니스 규칙 적용
 * - Repository 호출 및 에러 처리
 */

import * as repository from "./repository";
import type {
  InternalScore,
  MockScore,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  CreateMockScoreInput,
  UpdateMockScoreInput,
  ScoreActionResult,
} from "./types";

// ============================================
// 내신 성적 Service
// ============================================
// 레거시 함수들은 제거되었습니다. InternalScore 관련 함수를 사용하세요.

// ============================================
// 모의고사 성적 Service
// ============================================

/**
 * 모의고사 성적 목록 조회
 */
export async function getMockScores(
  studentId: string,
  tenantId?: string | null,
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  try {
    return await repository.findMockScores(studentId, tenantId, filters);
  } catch (error) {
    console.error("[score/service] 모의고사 성적 조회 실패:", error);
    return [];
  }
}

/**
 * 모의고사 성적 단건 조회
 */
export async function getMockScoreById(
  scoreId: string,
  studentId: string
): Promise<MockScore | null> {
  try {
    return await repository.findMockScoreById(scoreId, studentId);
  } catch (error) {
    console.error("[score/service] 모의고사 성적 조회 실패:", error);
    return null;
  }
}

/**
 * 모의고사 성적 생성
 */
export async function createMockScore(
  input: CreateMockScoreInput
): Promise<ScoreActionResult> {
  try {
    // 필수 필드 검증
    if (!input.student_id) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!input.grade || input.grade < 1 || input.grade > 3) {
      return { success: false, error: "올바른 학년을 입력하세요. (1-3)" };
    }

    if (!input.exam_date || !input.exam_title) {
      return { success: false, error: "시험 날짜와 시험명이 필요합니다." };
    }

    // 등급 검증
    if (
      input.grade_score !== undefined &&
      input.grade_score !== null &&
      (input.grade_score < 1 || input.grade_score > 9)
    ) {
      return { success: false, error: "등급은 1-9 사이여야 합니다." };
    }

    // 백분위 검증
    if (
      input.percentile !== undefined &&
      input.percentile !== null &&
      (input.percentile < 0 || input.percentile > 100)
    ) {
      return { success: false, error: "백분위는 0-100 사이여야 합니다." };
    }

    const scoreId = await repository.insertMockScore(input);
    return { success: true, scoreId };
  } catch (error) {
    console.error("[score/service] 모의고사 성적 생성 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "성적 생성에 실패했습니다.",
    };
  }
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScore(
  scoreId: string,
  studentId: string,
  updates: UpdateMockScoreInput
): Promise<ScoreActionResult> {
  try {
    // 등급 검증
    if (
      updates.grade_score !== undefined &&
      updates.grade_score !== null &&
      (updates.grade_score < 1 || updates.grade_score > 9)
    ) {
      return { success: false, error: "등급은 1-9 사이여야 합니다." };
    }

    // 백분위 검증
    if (
      updates.percentile !== undefined &&
      updates.percentile !== null &&
      (updates.percentile < 0 || updates.percentile > 100)
    ) {
      return { success: false, error: "백분위는 0-100 사이여야 합니다." };
    }

    // 기존 데이터 확인
    const existing = await repository.findMockScoreById(scoreId, studentId);
    if (!existing) {
      return { success: false, error: "성적을 찾을 수 없습니다." };
    }

    await repository.updateMockScoreById(scoreId, studentId, updates);
    return { success: true, scoreId };
  } catch (error) {
    console.error("[score/service] 모의고사 성적 수정 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "성적 수정에 실패했습니다.",
    };
  }
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScore(
  scoreId: string,
  studentId: string
): Promise<ScoreActionResult> {
  try {
    // 기존 데이터 확인
    const existing = await repository.findMockScoreById(scoreId, studentId);
    if (!existing) {
      return { success: false, error: "성적을 찾을 수 없습니다." };
    }

    await repository.deleteMockScoreById(scoreId, studentId);
    return { success: true };
  } catch (error) {
    console.error("[score/service] 모의고사 성적 삭제 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "성적 삭제에 실패했습니다.",
    };
  }
}

// ============================================
// 비즈니스 로직
// ============================================

/**
 * 학생의 평균 등급 계산
 */
export async function calculateAverageGrade(
  studentId: string,
  tenantId?: string | null
): Promise<{ schoolAvg: number | null; mockAvg: number | null }> {
  try {
    if (!tenantId) {
      return { schoolAvg: null, mockAvg: null };
    }

    const [schoolScores, mockScores] = await Promise.all([
      repository.findInternalScores(studentId, tenantId),
      repository.findMockScores(studentId, tenantId),
    ]);

    const schoolGrades = schoolScores
      .filter((s) => s.rank_grade !== null && s.rank_grade !== undefined)
      .map((s) => s.rank_grade as number);

    const mockGrades = mockScores
      .filter((s) => s.grade_score !== null && s.grade_score !== undefined)
      .map((s) => s.grade_score as number);

    const schoolAvg =
      schoolGrades.length > 0
        ? schoolGrades.reduce((a, b) => a + b, 0) / schoolGrades.length
        : null;

    const mockAvg =
      mockGrades.length > 0
        ? mockGrades.reduce((a, b) => a + b, 0) / mockGrades.length
        : null;

    return { schoolAvg, mockAvg };
  } catch (error) {
    console.error("[score/service] 평균 등급 계산 실패:", error);
    return { schoolAvg: null, mockAvg: null };
  }
}

/**
 * 과목별 성적 추이 조회
 */
export async function getScoreTrendBySubject(
  studentId: string,
  subjectGroupId: string,
  tenantId?: string | null
): Promise<{
  school: InternalScore[];
  mock: MockScore[];
}> {
  try {
    if (!tenantId) {
      return { school: [], mock: [] };
    }

    const [schoolScores, mockScores] = await Promise.all([
      repository.findInternalScores(studentId, tenantId, { subjectGroupId }),
      repository.findMockScores(studentId, tenantId, { subjectGroupId }),
    ]);

    return {
      school: schoolScores,
      mock: mockScores,
    };
  } catch (error) {
    console.error("[score/service] 성적 추이 조회 실패:", error);
    return { school: [], mock: [] };
  }
}
