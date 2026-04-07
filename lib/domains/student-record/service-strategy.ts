// ============================================
// 생기부 도메인 Service — 전략 탭 (수능최저 목표 / 시뮬레이션)
// service.ts에서 분리. 외부 참조는 service.ts re-export를 통해 접근.
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import * as repository from "./repository";
import type {
  MinScoreTargetInsert,
  MinScoreTargetUpdate,
  MinScoreSimulationInsert,
  MinScoreCriteria,
  StrategyTabData,
  StudentRecordActionResult,
} from "./types";
import { checkInterviewConflicts } from "./interview-conflict-checker";
import { simulateMinScore } from "./min-score-simulator";

const DOMAIN = "student-record";

// ============================================
// 전략 탭 데이터 조회 (지원현황 + 최저 시뮬)
// ============================================

export async function getStrategyTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<StrategyTabData> {
  try {
    const [applications, minScoreTargets, minScoreSimulations] = await Promise.all([
      repository.findApplicationsByStudentYear(studentId, schoolYear, tenantId),
      repository.findMinScoreTargetsByStudent(studentId, tenantId),
      repository.findMinScoreSimulationsByStudent(studentId, tenantId),
    ]);

    const interviewConflicts = checkInterviewConflicts(applications);

    return { applications, minScoreTargets, minScoreSimulations, interviewConflicts };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "getStrategyTabData" }, error, { studentId, schoolYear });
    return { applications: [], minScoreTargets: [], minScoreSimulations: [], interviewConflicts: [] };
  }
}

// ============================================
// 수능최저 목표 CRUD
// ============================================

export async function addMinScoreTarget(
  input: MinScoreTargetInsert,
): Promise<StudentRecordActionResult> {
  try {
    if (!input.university_name?.trim()) {
      return { success: false, error: "대학명을 입력해주세요." };
    }
    if (!input.department?.trim()) {
      return { success: false, error: "학과를 입력해주세요." };
    }
    const id = await repository.insertMinScoreTarget(input);
    return { success: true, data: { id } };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 추가 중 오류가 발생했습니다." };
  }
}

export async function updateMinScoreTarget(
  id: string,
  updates: MinScoreTargetUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await repository.updateMinScoreTargetById(id, updates);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "updateMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 수정 중 오류가 발생했습니다." };
  }
}

export async function removeMinScoreTarget(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteMinScoreTargetById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 수능최저 시뮬레이션 실행
// ============================================

export async function runMinScoreSimulation(
  input: Omit<MinScoreSimulationInsert, "is_met" | "grade_sum" | "gap" | "bottleneck_subjects" | "what_if">,
  criteria: MinScoreCriteria,
): Promise<StudentRecordActionResult> {
  try {
    const grades = (input.actual_grades ?? {}) as Record<string, number>;
    const result = simulateMinScore(criteria, grades);

    const id = await repository.insertMinScoreSimulation({
      ...input,
      is_met: result.isMet,
      grade_sum: result.gradeSum,
      gap: result.gap,
      bottleneck_subjects: result.bottleneckSubjects,
      what_if: (await import("./types")).toDbJson(result.whatIf),
    });

    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "runMinScoreSimulation" }, error);
    return { success: false, error: "시뮬레이션 실행 중 오류가 발생했습니다." };
  }
}

export async function removeMinScoreSimulation(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteMinScoreSimulationById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeMinScoreSimulation" }, error);
    return { success: false, error: "시뮬레이션 삭제 중 오류가 발생했습니다." };
  }
}
