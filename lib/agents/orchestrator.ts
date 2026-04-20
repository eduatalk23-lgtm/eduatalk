// ============================================
// Agent 오케스트레이터
// streamText + tools. 실제 stopWhen/maxSteps 는 caller(app/api/agent/route.ts)에서 설정:
//   - gemini-2.5-flash: stepCountIs(12), maxOutputTokens 8192
//   - gemini-3.1-pro-preview: stepCountIs(16), maxOutputTokens 16384
//   - abortSignal: req.signal ∪ AbortSignal.timeout(55_000)
//   - maxRetries: 1
// ============================================

import type { AgentContext } from "./types";
import { buildUIContextBlock } from "./ui-state";
import { buildDomainKnowledgeBlock } from "./domain-knowledge";
import { buildGuideContextSection } from "@/lib/domains/student-record/guide-context";
import { SCHOOL_CATEGORY_LABELS } from "@/lib/domains/student-record/constants";
import { createRecordTools } from "./tools/record-tools";
import { createStrategyTools } from "./tools/strategy-tools";
import { createDataTools } from "./tools/data-tools";
import { createGuideTools } from "./tools/guide-tools";
import { createAdmissionTools } from "./tools/admission-tools";
import { createInterviewTools } from "./tools/interview-tools";
import { createReportTools } from "./tools/report-tools";
import { createBypassTools } from "./tools/bypass-tools";
import { createNavigationTools } from "./tools/navigation-tools";
import { createMetaTools } from "./tools/meta-tools";
import { createMemoryTools } from "./tools/memory-tools";
import { searchSimilarCases } from "./memory/search-service";
import { searchSimilarCorrections } from "./memory/correction-service";
import { buildOutcomeCalibrationBlock } from "./memory/outcome-service";

function buildStudentInfoSection(ctx: AgentContext): string {
  const lines = [
    `- 학생 이름: ${ctx.studentName}`,
    `- 학년도: ${ctx.schoolYear}`,
  ];
  if (ctx.studentGrade) lines.push(`- 학년: ${ctx.studentGrade}학년`);
  if (ctx.schoolName) {
    const catLabel = ctx.schoolCategory
      ? SCHOOL_CATEGORY_LABELS[ctx.schoolCategory]
      : null;
    lines.push(`- 학교: ${ctx.schoolName}${catLabel ? ` (${catLabel})` : ""}`);
  }
  if (ctx.targetMajor) lines.push(`- 희망 전공: ${ctx.targetMajor}`);
  if (ctx.curriculumRevision) lines.push(`- 교육과정: ${ctx.curriculumRevision}`);
  return lines.join("\n");
}

function buildSystemPrompt(ctx: AgentContext): string {
  return `당신은 대입 컨설팅 AI 어시스턴트입니다. 컨설턴트가 학생의 생기부를 분석하고 전략을 수립하는 것을 도와줍니다.

## 현재 학생 정보
${buildStudentInfoSection(ctx)}

## 중요 규칙

1. **데이터 우선**: 분석 전 반드시 데이터 조회. generateSetekDraft는 getStudentRecords로 기존 세특 확인 후 existingContent 전달
2. **한국어 응답**: 항상 한국어로 응답하세요.
3. **구조화된 응답**: 분석 결과는 항목별로 정리하여 가독성 있게 제공하세요.
4. **근거 기반**: 모든 평가와 제안에는 구체적 근거를 포함하세요.
5. **모호한 질문**: 사용자 질문이 모호한 경우, 명확화를 요청하세요.
6. **도구 조합 패턴**: 복합적인 질문에는 여러 도구를 순차 활용하세요.
   - "세특 분석" → getStudentRecords → analyzeCompetency 또는 analyzeHighlight (둘 다 아님)
   - "전형 추천" → assessExtracurricularStrength + analyzeGradeTrend → 의사결정 트리 적용
   - "대학 맞춤 전략" → getUniversityEvalCriteria + getInterviewQuestionBank → 대학 특성 기반 조언
   - "배치 분석" → 점수 확인 → runPlacementAnalysis → filterPlacementResults (점수 불완전 시 먼저 요청)
   - "면접 준비" → getDepartmentInterviewField + getInterviewQuestionBank → generateInterviewQuestions
   - "수능최저 확인" → simulateMinScoreRequirement (점수를 사용자에게 먼저 확인)
7. **토큰 절약**: 불필요하게 긴 데이터를 반복하지 마세요. 요약하여 전달하세요.
8. **면접**: interviewFormat 파라미터 반드시 전달 (의약학=mmi, 연세대 활동우수형=제시문). 질문 생성 후 면접관 역할로 진행, 답변 시 evaluateAnswer로 평가
9. **결과 저장**: saveDiagnosisResult/saveCompetencyScore/saveStrategy는 사용자가 "저장해줘"라고 요청할 때만 호출. 자동 저장 금지
10. **네비게이션**: 분석 결과 설명 시 관련 섹션 이동을 제안. 반드시 reason과 텍스트 설명 함께 제공
11. **도구 최소화**: 상황에 맞는 최소한의 도구만 사용하세요.
13. **사고 정리(think) — 필수 사용 규칙**:
   - **3개 이상 도구를 호출할 것으로 예상되면**, 반드시 think를 먼저 호출하여 "어떤 도구를 어떤 순서로 부를지" 실행 계획을 세우세요.
   - **도구 결과가 모순될 때** (예: 내신은 유리하나 세특이 불리), think로 종합 판단을 정리한 뒤 답변하세요.
   - **전형 추천, 6장 배분, 배치 분석** 등 복합 의사결정에는 항상 think를 사용하세요.
   - 단순 조회나 1개 도구 호출에는 사용하지 마세요.
12. **시간 소요 안내**: generateReport(30-45초), triggerPipeline(30-120초, 비동기 — getPipelineStatus로 결과 확인) 등 장시간 도구는 사전 안내
14. **레이어 이해**: 생기부 에디터는 7개 레이어로 구성됩니다. 각 레이어는 독립적으로 접근 가능하지만, 컨설팅 워크플로우에는 흐름이 있습니다.
   **[사전 활동 단계]** 실제 생기부 기록이 나오기 전:
   - **논의(chat)** → 학생과 소통하여 관심사/희망활동 도출. 모든 것의 시작점
   - **가이드(guide)** → 논의에서 나온 관심사에 맞는 탐구 가이드 배정. getStudentAssignments로 조회
   - **방향(direction)** → 배정된 가이드 기반으로 과목별 세특 작성 방향 + 키워드 반영률 확인
   - **가안(draft)** → 방향을 참고하여 활동 전 미리 세특 초안 작성. 3트랙: AI초안→컨설턴트가안→확정본
   **[사후 분석 단계]** 실제 생기부 내용이 나온 후:
   - **NEIS(neis)** → 학교에서 나온 실제 생기부 원본 확인 + 편집
   - **분석(analysis)** → NEIS 원본 기반 역량 태깅/분석. 3트랙: AI태그→컨설턴트태그→확정태그
   **[모든 단계 공통]**:
   - **메모(memo)** → 특정 단계에 속하지 않음. 논의/가이드/방향/가안/NEIS/분석 어느 시점에서든 수시로 기록하는 노트
   **흐름**: 논의(학생 소통) → 가이드배정 → 방향설정 → 가안작성 → (실 기록 나옴) → NEIS확인 → 분석
   - 현재 탭이 chat이면 학생 관심사/활동 도출 맥락, guide/direction/draft면 사전 준비 맥락, neis/analysis면 사후 분석 맥락으로 응답. memo는 어떤 맥락에서든 가능${buildDomainKnowledgeBlock({ studentGrade: ctx.studentGrade, schoolCategory: ctx.schoolCategory, targetMajor: ctx.targetMajor, curriculumRevision: ctx.curriculumRevision })}${buildUIContextBlock(ctx.uiState)}`;
}

export async function createOrchestrator(ctx: AgentContext) {
  const tools = {
    ...createMetaTools(),
    ...createMemoryTools(ctx),
    ...createDataTools(ctx),
    ...createRecordTools(ctx),
    ...createStrategyTools(ctx),
    ...createGuideTools(ctx),
    ...createAdmissionTools(ctx),
    ...createInterviewTools(ctx),
    ...createReportTools(ctx),
    ...createBypassTools(ctx),
    ...createNavigationTools(),
  };

  // 가이드 배정 문맥 자동 주입 (실패 시 빈 문자열)
  let guideContextBlock = "";
  try {
    guideContextBlock = await buildGuideContextSection(ctx.studentId, "summary");
  } catch {
    // graceful — 가이드 배정이 없거나 DB 오류 시 건너뜀
  }

  // 유사 케이스 자동 주입 (실패 시 빈 문자열, 1500자 상한)
  let caseContextBlock = "";
  try {
    caseContextBlock = await buildCaseContextSection(ctx);
  } catch {
    // graceful — 케이스 없거나 임베딩 실패 시 건너뜀
  }

  // 관련 교정 피드백 자동 주입 (실패 시 빈 문자열, 1000자 상한)
  let correctionContextBlock = "";
  try {
    correctionContextBlock = await buildCorrectionContextSection(ctx);
  } catch {
    // graceful
  }

  // 입시 결과 기반 정확도 보정 (실패 시 빈 문자열, 800자 상한)
  let outcomeCalibrationBlock = "";
  try {
    if (ctx.tenantId) {
      outcomeCalibrationBlock = await buildOutcomeCalibrationBlock(ctx.tenantId);
    }
  } catch {
    // graceful
  }

  // S6-4: 활성 경고 자동 주입 (실패 시 빈 문자열)
  let activeWarningsBlock = "";
  try {
    activeWarningsBlock = await buildActiveWarningsBlock(ctx.studentId);
  } catch {
    // graceful — 경고 조회 실패 시 시스템 프롬프트에서 생략
  }

  return {
    tools,
    systemPrompt: buildSystemPrompt(ctx) + guideContextBlock + caseContextBlock + correctionContextBlock + outcomeCalibrationBlock + activeWarningsBlock,
  };
}

/** 유사 케이스 3건을 시스템 프롬프트용 텍스트로 변환 (1500자 상한) */
async function buildCaseContextSection(ctx: AgentContext): Promise<string> {
  if (!ctx.tenantId) return "";

  const queryParts: string[] = [];
  if (ctx.targetMajor) queryParts.push(ctx.targetMajor);
  if (ctx.studentGrade) queryParts.push(`${ctx.studentGrade}학년`);
  queryParts.push("컨설팅");
  const query = queryParts.join(" ");

  const cases = await searchSimilarCases({
    query,
    tenantId: ctx.tenantId,
    gradeFilter: ctx.studentGrade ?? null,
    matchCount: 3,
    similarityThreshold: 0.45,
  });

  if (cases.length === 0) return "";

  const MAX_CHARS = 1500;
  const lines = ["\n\n## 유사 과거 사례 (참고용, 맹신 금지)"];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const header = `\n### 사례 ${i + 1} (유사도 ${Math.round(c.score * 100)}%)`;
    const grade = c.student_grade ? `${c.student_grade}학년` : "학년 미상";
    const major = c.target_major ?? "전공 미정";
    const body = `- ${grade}, ${major}\n- 진단: ${c.diagnosis_summary.slice(0, 150)}\n- 전략: ${c.strategy_summary.slice(0, 150)}`;
    const outcome = c.outcome ? `\n- 결과: ${c.outcome}` : "";
    lines.push(header + "\n" + body + outcome);
  }

  const result = lines.join("\n");
  return result.slice(0, MAX_CHARS);
}

/**
 * S6-4: 활성 경고 상위 5건을 시스템 프롬프트에 주입 (500자 상한).
 * critical/high 우선 정렬 후 최대 5건. 0건이면 빈 문자열 반환.
 */
async function buildActiveWarningsBlock(studentId: string): Promise<string> {
  const { fetchActiveWarnings } = await import(
    "@/lib/domains/student-record/actions/report"
  );
  const warnings = await fetchActiveWarnings(studentId);
  if (warnings.length === 0) return "";

  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...warnings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  const top5 = sorted.slice(0, 5);
  const lines = ["\n\n## 현재 활성 경고"];
  for (const w of top5) {
    lines.push(`- [${w.severity}] ${w.title}: ${w.message}`);
  }

  const result = lines.join("\n");
  // 500자 상한 (프롬프트 길이 보호)
  return result.slice(0, 500);
}

/** 관련 교정 피드백 3건을 시스템 프롬프트에 주입 (1000자 상한) */
async function buildCorrectionContextSection(ctx: AgentContext): Promise<string> {
  if (!ctx.tenantId) return "";

  const queryParts: string[] = [];
  if (ctx.targetMajor) queryParts.push(ctx.targetMajor);
  if (ctx.studentGrade) queryParts.push(`${ctx.studentGrade}학년`);
  queryParts.push("컨설팅 분석");
  const query = queryParts.join(" ");

  const corrections = await searchSimilarCorrections({
    query,
    tenantId: ctx.tenantId,
    matchCount: 3,
    similarityThreshold: 0.5,
  });

  if (corrections.length === 0) return "";

  const MAX_CHARS = 1000;
  const lines = ["\n\n## 과거 교정 피드백 (반드시 참고)"];
  lines.push("아래는 컨설턴트가 과거 유사 상황에서 교정한 내용입니다. 같은 실수를 반복하지 마세요.");

  for (const c of corrections) {
    const typeLabel = { factual: "사실오류", strategic: "전략오류", nuance: "뉘앙스", missing: "누락" }[c.correction_type] ?? c.correction_type;
    lines.push(`- [${typeLabel}] ${c.correction_text.slice(0, 200)}`);
  }

  const result = lines.join("\n");
  return result.slice(0, MAX_CHARS);
}
