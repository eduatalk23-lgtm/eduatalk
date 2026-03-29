// ============================================
// Agent 오케스트레이터
// streamText + tools + maxSteps:7 패턴
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
11. **도구 최소화**: 49개 도구 중 상황에 맞는 최소한만 사용하세요.
12. **시간 소요 안내**: generateReport(30-45초), triggerPipeline(30-120초, 비동기 — getPipelineStatus로 결과 확인) 등 장시간 도구는 사전 안내${buildDomainKnowledgeBlock({ studentGrade: ctx.studentGrade, schoolCategory: ctx.schoolCategory, targetMajor: ctx.targetMajor, curriculumRevision: ctx.curriculumRevision })}${buildUIContextBlock(ctx.uiState)}`;
}

export async function createOrchestrator(ctx: AgentContext) {
  const tools = {
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

  return {
    tools,
    systemPrompt: buildSystemPrompt(ctx) + guideContextBlock,
  };
}
