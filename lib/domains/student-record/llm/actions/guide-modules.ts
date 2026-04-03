// ============================================
// 태스크 모듈화 — 설계 문서 C. 태스크 모듈화
// NEIS 분석 모듈 (analyzeXxx) + 컨설팅 모듈 (generateXxxDirection)
//
// 오케스트레이터(pipeline-task-runners.ts, pipeline-phases.ts)는
// 이 파일에서 import 하고, 원본 함수는 하위 호환용으로 유지.
//
// 후속 과제: LLM 함수가 resolvedRecords를 직접 소비하도록
//           fetchReportData() 의존 없이 시그니처 변경.
// ============================================

import { withRetry } from "../retry";

// ── NEIS 분석 모듈 ───────────────────────────────────────
// NEIS imported_content가 존재하는 학년에 대해 실 생기부 분석

export async function analyzeSetekGuide(
  ...args: Parameters<typeof import("./generateSetekGuide").generateSetekGuide>
): ReturnType<typeof import("./generateSetekGuide").generateSetekGuide> {
  const { generateSetekGuide } = await import("./generateSetekGuide");
  return withRetry(() => generateSetekGuide(...args), { label: "analyzeSetekGuide" });
}

export async function analyzeChangcheGuide(
  ...args: Parameters<typeof import("./generateChangcheGuide").generateChangcheGuide>
): ReturnType<typeof import("./generateChangcheGuide").generateChangcheGuide> {
  const { generateChangcheGuide } = await import("./generateChangcheGuide");
  return withRetry(() => generateChangcheGuide(...args), { label: "analyzeChangcheGuide" });
}

export async function analyzeHaengteukGuide(
  ...args: Parameters<typeof import("./generateHaengteukGuide").generateHaengteukGuide>
): ReturnType<typeof import("./generateHaengteukGuide").generateHaengteukGuide> {
  const { generateHaengteukGuide } = await import("./generateHaengteukGuide");
  return withRetry(() => generateHaengteukGuide(...args), { label: "analyzeHaengteukGuide" });
}

// ── 컨설팅 모듈 ──────────────────────────────────────────
// NEIS 없는 학년(수강계획 기반)에 대해 방향/가이드 생성

export async function generateSetekDirection(
  ...args: Parameters<typeof import("./generateSetekGuide").generateProspectiveSetekGuide>
): ReturnType<typeof import("./generateSetekGuide").generateProspectiveSetekGuide> {
  const { generateProspectiveSetekGuide } = await import("./generateSetekGuide");
  return withRetry(() => generateProspectiveSetekGuide(...args), { label: "generateSetekDirection" });
}

export async function generateChangcheDirection(
  ...args: Parameters<typeof import("./generateChangcheGuide").generateProspectiveChangcheGuide>
): ReturnType<typeof import("./generateChangcheGuide").generateProspectiveChangcheGuide> {
  const { generateProspectiveChangcheGuide } = await import("./generateChangcheGuide");
  return withRetry(() => generateProspectiveChangcheGuide(...args), { label: "generateChangcheDirection" });
}

export async function generateHaengteukDirection(
  ...args: Parameters<typeof import("./generateHaengteukGuide").generateProspectiveHaengteukGuide>
): ReturnType<typeof import("./generateHaengteukGuide").generateProspectiveHaengteukGuide> {
  const { generateProspectiveHaengteukGuide } = await import("./generateHaengteukGuide");
  return withRetry(() => generateProspectiveHaengteukGuide(...args), { label: "generateHaengteukDirection" });
}
