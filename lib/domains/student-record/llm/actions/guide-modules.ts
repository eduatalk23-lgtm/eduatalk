// ============================================
// 태스크 모듈화 — 설계 문서 C. 태스크 모듈화
// NEIS 분석 모듈 (analyzeXxx) + 컨설팅 모듈 (generateXxxDirection)
//
// 오케스트레이터(pipeline-task-runners-guide.ts, pipeline-grade-phases.ts)는
// 이 파일에서 import 하고, 원본 함수는 하위 호환용으로 유지.
//
// ⚠️ 명시적 시그니처 사용: ...args spread 패턴은 TypeScript가 동적 import의
//    타입 불일치를 감지하지 못해 시그니처 붕괴를 유발했으므로 제거함.
// ============================================

import { withRetry } from "../retry";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type {
  GuideAnalysisContext,
  SetekGuideResult,
  ChangcheGuideResult,
  HaengteukGuideResult,
} from "../types";

// ── NEIS 분석 모듈 ───────────────────────────────────────
// NEIS imported_content가 존재하는 학년에 대해 실 생기부 분석

export async function analyzeSetekGuide(
  studentId: string,
  targetGrades?: number[],
  edgePromptSection?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
  cachedReport?: import("../../actions/report").ReportData,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
  const { generateSetekGuide } = await import("./generateSetekGuide");
  return withRetry(
    () => generateSetekGuide(studentId, targetGrades, edgePromptSection, targetSchoolYear, pipelineAnalysisContext, cachedReport),
    { label: "analyzeSetekGuide" },
  );
}

export async function analyzeChangcheGuide(
  studentId: string,
  targetGrades?: number[],
  edgePromptSection?: string,
  setekGuideContext?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
  cachedReport?: import("../../actions/report").ReportData,
): Promise<ActionResponse<ChangcheGuideResult & { summaryId: string }>> {
  const { generateChangcheGuide } = await import("./generateChangcheGuide");
  return withRetry(
    () => generateChangcheGuide(studentId, targetGrades, edgePromptSection, setekGuideContext, targetSchoolYear, pipelineAnalysisContext, cachedReport),
    { label: "analyzeChangcheGuide" },
  );
}

export async function analyzeHaengteukGuide(
  studentId: string,
  targetGrades?: number[],
  edgePromptSection?: string,
  changcheGuideContext?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
  cachedReport?: import("../../actions/report").ReportData,
): Promise<ActionResponse<HaengteukGuideResult & { summaryId: string }>> {
  const { generateHaengteukGuide } = await import("./generateHaengteukGuide");
  return withRetry(
    () => generateHaengteukGuide(studentId, targetGrades, edgePromptSection, changcheGuideContext, targetSchoolYear, pipelineAnalysisContext, cachedReport),
    { label: "analyzeHaengteukGuide" },
  );
}

// ── 컨설팅 모듈 ──────────────────────────────────────────
// NEIS 없는 학년(수강계획 기반)에 대해 방향/가이드 생성

export async function generateSetekDirection(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("../../actions/report").ReportData,
  grades: number[],
  edgePromptSection?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
): Promise<ActionResponse<SetekGuideResult & { summaryId: string }>> {
  const { generateProspectiveSetekGuide } = await import("./generateSetekGuide");
  return withRetry(
    () => generateProspectiveSetekGuide(studentId, tenantId, userId, report, grades, edgePromptSection, targetSchoolYear, pipelineAnalysisContext),
    { label: "generateSetekDirection" },
  );
}

export async function generateChangcheDirection(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("../../actions/report").ReportData,
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null,
  edgePromptSection?: string,
  setekGuideContext?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
): Promise<ActionResponse<ChangcheGuideResult & { summaryId: string }>> {
  const { generateProspectiveChangcheGuide } = await import("./generateChangcheGuide");
  return withRetry(
    () => generateProspectiveChangcheGuide(studentId, tenantId, userId, report, coursePlanData, edgePromptSection, setekGuideContext, targetSchoolYear, pipelineAnalysisContext),
    { label: "generateChangcheDirection" },
  );
}

export async function generateHaengteukDirection(
  studentId: string,
  tenantId: string,
  userId: string,
  report: import("../../actions/report").ReportData,
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null,
  edgePromptSection?: string,
  changcheGuideContext?: string,
  targetSchoolYear?: number,
  pipelineAnalysisContext?: GuideAnalysisContext,
): Promise<ActionResponse<HaengteukGuideResult & { summaryId: string }>> {
  const { generateProspectiveHaengteukGuide } = await import("./generateHaengteukGuide");
  return withRetry(
    () => generateProspectiveHaengteukGuide(studentId, tenantId, userId, report, coursePlanData, edgePromptSection, changcheGuideContext, targetSchoolYear, pipelineAnalysisContext),
    { label: "generateHaengteukDirection" },
  );
}
