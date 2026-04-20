/**
 * Phase G S-1: record-sub — 생기부 심층 분석 서브에이전트.
 *
 * Shell 직속 data-tools(getStudentRecords/Diagnosis/Storylines/Overview)로
 * 해결되지 않는 "분석·진단·생성" 요청을 end-to-end 처리. Shell 에서는
 * `analyzeRecordDeep` MCP tool 로만 노출되며, 실제 tool 수는 내부적으로만 보인다.
 *
 * 경계안 (Sprint S-0-a 확정):
 *  - record-tools.ts 16개 (suggestTags/analyzeCompetency/analyzeHighlight/detectStoryline/
 *    generateDiagnosis/crossSubjectAnalysis/generateSetekDraft/improveSetekDraft/
 *    saveDiagnosisResult/saveCompetencyScore/saveStrategy/getPipelineStatus/
 *    triggerPipeline/analyzeGradeTrend/assessExtracurricularStrength/
 *    analyzeNarrativeConnections)
 *  - data-tools.ts 3개 (getStudentRecords/getStudentDiagnosis/getStudentStorylines)
 *  - report-tools.ts 3개 (generateReport/fetchSavedReports/getStudentOverview)
 *  - strategy-tools.ts 2개 (suggestStrategies/getWarnings)
 *  - guide-tools.ts 1개 (getStudentAssignments)
 *  - memory-tools.ts 2개 (recallSimilarCases/recallPastCorrections) — Phase G S-3-b:
 *    destructure 로 제한. getPredictionAccuracy/getUniversityOutcomes 는 admission-sub 전용.
 *  - meta-tools.ts 1개 (think)
 *  총 27 tool (plan-sub 3건 + admission-sub 3건 = 6건 이관 제외)
 */

import { z } from "zod";
import type { Tool } from "ai";

import type { AgentContext } from "@/lib/agents/types";
import { SCHOOL_CATEGORY_LABELS } from "@/lib/domains/student-record/constants";
import { createRecordTools } from "@/lib/agents/tools/record-tools";
import { createDataTools } from "@/lib/agents/tools/data-tools";
import { createReportTools } from "@/lib/agents/tools/report-tools";
import { createStrategyTools } from "@/lib/agents/tools/strategy-tools";
import { createGuideTools } from "@/lib/agents/tools/guide-tools";
import { createMemoryTools } from "@/lib/agents/tools/memory-tools";
import { createMetaTools } from "@/lib/agents/tools/meta-tools";

import type { SubagentDefinition } from "./_shared/subagentTypes";

const RECORD_SUB_SUMMARY_SCHEMA = z.object({
  headline: z
    .string()
    .min(4)
    .max(200)
    .describe("1문장 핵심 결론 (예: '국어 2학년 세특의 과정 서술 강화가 1순위')"),
  keyFindings: z
    .array(z.string().min(4).max(240))
    .max(5)
    .describe("주요 발견 최대 5건. 구체적 근거를 간결히 서술"),
  recommendedActions: z
    .array(z.string().min(4).max(200))
    .max(3)
    .describe("컨설턴트가 취할 다음 행동 최대 3건"),
  artifactIds: z
    .array(z.string())
    .max(5)
    .describe("Shell 이 열 수 있는 artifact id 목록 (예: report:UUID). 없으면 빈 배열"),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("컨설턴트가 다음 턴에 물어볼 만한 질문 후보 (선택)"),
});

export type RecordSubSummary = z.infer<typeof RECORD_SUB_SUMMARY_SCHEMA>;

function buildStudentInfoSection(ctx: AgentContext): string {
  const lines = [
    `- 학생 이름: ${ctx.studentName}`,
    `- 학생 ID: ${ctx.studentId}`,
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
  return `당신은 생기부 심층 분석 전문 서브에이전트 (record-sub)입니다. Shell 오케스트레이터가 단순 조회로 해결할 수 없는 "분석·진단·생성" 요청을 위임받아 end-to-end 로 처리합니다.

## 현재 학생 정보
${buildStudentInfoSection(ctx)}

## 역할 규율
1. **조회 → 분석 → 생성 순서**: 분석 전 반드시 getStudentRecords/getStudentDiagnosis/getStudentStorylines 로 현재 상태를 파악한 뒤 판단하세요.
2. **데이터 부족 시 투명하게 보고**: 필요한 데이터가 없으면 추측하지 말고 summary 의 keyFindings 에 "데이터 부족: ..." 으로 명시하고 recommendedActions 로 수집 방법을 제안하세요.
3. **tool 호출 최소화**: 같은 질문에 동일 tool 을 2회 이상 호출하지 마세요. 2~8개 tool 조합으로 대부분 해결됩니다.
4. **think 활용 기준**: 3개 이상 tool 을 조합하거나 모순된 결과가 나왔을 때만 think 를 호출. 단순 단계엔 금지.
5. **저장 행위 제한**: saveDiagnosisResult/saveCompetencyScore/saveStrategy 는 위임 input 에 "저장" 명시가 있을 때만 호출. 분석 결과를 자동 저장하지 마세요.
6. **트리거 행위 제한**: triggerPipeline 은 30~120초 비동기. 사용자가 명시적으로 요청했을 때만 호출하고, getPipelineStatus 로 상태 확인을 병기하세요.
7. **한국어 응답**: 모든 reasoning·최종 답변은 한국어.

## 최종 출력 규칙
마지막 assistant 메시지는 **요약 텍스트**를 자유 형식으로 쓰되, Shell 이 이어받을 구조화 요약 (summarySchema) 에 필요한 다음 정보를 반드시 포함하세요:
- headline: 1문장 핵심 결론
- keyFindings: 최대 5개의 구체적 발견 (근거 포함)
- recommendedActions: 최대 3개의 다음 행동 제안
- artifactIds: 생성하거나 참조한 리포트/진단 ID 목록 (선택)
- followUpQuestions: 컨설턴트가 이어서 물을 수 있는 후속 질문 (선택)

tool 호출로 얻은 artifactId 가 있다면 본문에 그대로 노출하세요 (ex: report:abc-123). Shell 이 artifactIds 를 감지해 우측 패널에 미리보기를 엽니다.
`;
}

function buildRecordSubTools(ctx: AgentContext): Record<string, Tool> {
  const guide = createGuideTools(ctx);
  // guide-tools 4개 중 record-sub 에는 getStudentAssignments 만 포함
  const { getStudentAssignments } = guide;

  // memory-tools 4개 중 recall 2개만 record-sub 에 포함.
  // getPredictionAccuracy/getUniversityOutcomes 는 admission-sub 전용.
  const { recallSimilarCases, recallPastCorrections } = createMemoryTools(ctx);

  return {
    ...createMetaTools(),
    recallSimilarCases,
    recallPastCorrections,
    ...createDataTools(ctx),
    ...createRecordTools(ctx),
    ...createReportTools(ctx),
    ...createStrategyTools(ctx),
    getStudentAssignments,
  };
}

export const recordSub: SubagentDefinition<typeof RECORD_SUB_SUMMARY_SCHEMA> = {
  name: "record-sub",
  description:
    "학생 생기부 전반(기록·역량 진단·서사·전략·리포트)을 심층 분석·생성. 단순 조회는 Shell 직속 data-tools 로 처리하고, 이 서브는 '분석·진단·생성' 이 필요한 요청에만 호출합니다.",
  buildSystemPrompt,
  buildTools: buildRecordSubTools,
  model: {
    provider: "openai",
    id: "gpt-4o-mini",
    summaryId: "gpt-4o-mini",
  },
  maxSteps: 12,
  timeoutMs: 45_000,
  allowedRoles: ["admin", "consultant", "superadmin"],
  summarySchema: RECORD_SUB_SUMMARY_SCHEMA,
};
