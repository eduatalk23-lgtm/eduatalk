/**
 * Phase G S-3-b: admission-sub — 입시 배치·면접·교차지원 서브에이전트.
 *
 * Shell 직속 tool 로는 불가능한 "입시 배치 분석·면접 준비·교차지원 탐색·
 * 예측 정확도 기반 의사결정" 흐름을 end-to-end 처리. Shell 에서는
 * `analyzeAdmission` MCP tool 로만 노출.
 *
 * 경계안 (Sprint S-0-a 확정):
 *  - admission-tools.ts 10개 (searchAdmissionData/getUniversityScoreInfo/
 *    runPlacementAnalysis/filterPlacementResults/simulateCardAllocation/
 *    analyzeScoreImpact/getUniversityEvalCriteria/getInterviewQuestionBank/
 *    getDepartmentInterviewField/simulateMinScoreRequirement — S-3-b 에서 이관)
 *  - interview-tools.ts 4개 (generateInterviewQuestions/evaluateAnswer/
 *    conductMockInterview/getInterviewPrep)
 *  - bypass-tools.ts 3개 (getBypassCandidates/searchBypassDepartments/
 *    runBypassAnalysis)
 *  - memory-tools.ts 2개 destructure (getPredictionAccuracy/getUniversityOutcomes)
 *  - report-tools.ts 1개 destructure (getStudentOverview) — 학생 맥락 확인용
 *  - meta-tools.ts 1개 (think)
 *  총 21 tool. recallSimilarCases/recallPastCorrections 는 record-sub 전용.
 */

import { z } from "zod";
import type { Tool } from "ai";

import type { AgentContext } from "@/lib/agents/types";
import { SCHOOL_CATEGORY_LABELS } from "@/lib/domains/student-record/constants";
import { createAdmissionTools } from "@/lib/agents/tools/admission-tools";
import { createInterviewTools } from "@/lib/agents/tools/interview-tools";
import { createBypassTools } from "@/lib/agents/tools/bypass-tools";
import { createMemoryTools } from "@/lib/agents/tools/memory-tools";
import { createReportTools } from "@/lib/agents/tools/report-tools";
import { createMetaTools } from "@/lib/agents/tools/meta-tools";

import type { SubagentDefinition } from "./_shared/subagentTypes";

const ADMISSION_SUB_SUMMARY_SCHEMA = z.object({
  headline: z
    .string()
    .min(4)
    .max(200)
    .describe("1문장 핵심 결론 (예: '상향 2·적정 3·안전 1 구성, 고려대 경영 우선권')"),
  recommendedUniversities: z
    .array(z.string().min(1).max(120))
    .max(10)
    .describe("추천 대학·학과 상위 목록. 호출하지 않았으면 빈 배열"),
  keyFindings: z
    .array(z.string().min(4).max(240))
    .max(5)
    .describe("주요 발견 최대 5건. 배치·면접·교차지원 근거 구체적으로 서술"),
  strategyNotes: z
    .array(z.string().min(4).max(200))
    .max(5)
    .describe("전략 메모 (상향/적정/안전 배분, 면접 대비 포인트 등). 없으면 빈 배열"),
  warnings: z
    .array(z.string().min(4).max(200))
    .max(5)
    .describe(
      "주의 사항 (수능최저 미충족·예측 정확도 하락·교차지원 제약 등). 없으면 빈 배열",
    ),
  recommendedActions: z
    .array(z.string().min(4).max(200))
    .max(3)
    .describe("컨설턴트가 취할 다음 행동 최대 3건"),
  artifactIds: z
    .array(z.string())
    .max(5)
    .describe("Shell 이 열 수 있는 artifact id 목록 (예: placement:UUID). 없으면 빈 배열"),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("컨설턴트가 다음 턴에 물어볼 만한 질문 후보 (선택)"),
});

export type AdmissionSubSummary = z.infer<typeof ADMISSION_SUB_SUMMARY_SCHEMA>;

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
  return `당신은 입시 배치·면접·교차지원 전문 서브에이전트 (admission-sub)입니다. Shell 오케스트레이터가 단순 조회로 해결할 수 없는 "입시 배치 분석·면접 준비·교차지원 탐색·예측 정확도 기반 의사결정" 요청을 위임받아 end-to-end 로 처리합니다.

## 현재 학생 정보
${buildStudentInfoSection(ctx)}

## 역할 규율
1. **맥락 → 분석 → 전략 순서**: 분석 전 반드시 getStudentOverview 로 희망 전공·학년을 확인하고, 배치 분석이 필요하면 점수 정보를 runPlacementAnalysis 에 전달하세요.
2. **배치 분석 조합 패턴**: "배치" 요청이면 runPlacementAnalysis → filterPlacementResults → simulateCardAllocation 순서를 기본으로, 필요 시 getPredictionAccuracy 로 예측 신뢰도 확인.
3. **면접 준비 조합 패턴**: "면접 준비" 요청이면 getDepartmentInterviewField → getInterviewQuestionBank → generateInterviewQuestions 순서. interviewFormat 필수 (의약학=mmi, 연세대 활동우수형=제시문).
4. **교차지원 조합 패턴**: "교차지원" 요청이면 getBypassCandidates → searchBypassDepartments → runBypassAnalysis 순서.
5. **수능최저 확인**: 수능최저 관련 요청은 simulateMinScoreRequirement 1회 호출. 입력 등급이 없으면 summary 에 "데이터 부족" 명시.
6. **예측 정확도 가드**: 배치·교차지원 결과를 확정 전, getPredictionAccuracy / getUniversityOutcomes 로 해당 연도·대학의 예측 정확도를 확인해 warnings 에 반영하세요.
7. **tool 호출 최소화**: 같은 질문에 동일 tool 을 2회 이상 호출하지 마세요. 4~10개 tool 조합으로 대부분 해결.
8. **think 활용 기준**: 3개 이상 tool 을 조합하거나 배치·교차·면접이 얽힌 복합 의사결정에만 think. 단순 단계엔 금지.
9. **데이터 부족 시 투명하게 보고**: 점수·학생 정보가 없으면 추측하지 말고 keyFindings 에 "데이터 부족: ..." 으로 명시하고 recommendedActions 로 수집 방법을 제안.
10. **한국어 응답**: 모든 reasoning·최종 답변은 한국어.

## 최종 출력 규칙
마지막 assistant 메시지는 **요약 텍스트**를 자유 형식으로 쓰되, Shell 이 이어받을 구조화 요약 (summarySchema) 에 필요한 다음 정보를 반드시 포함하세요:
- headline: 1문장 핵심 결론
- recommendedUniversities: 추천 대학·학과 상위 이름. 호출하지 않았으면 빈 배열
- keyFindings: 최대 5개의 구체적 발견 (근거 포함)
- strategyNotes: 상향/적정/안전 배분·면접 대비 포인트 등 전략 메모
- warnings: 수능최저 미충족·예측 정확도 하락·교차지원 제약 등 주의 사항
- recommendedActions: 최대 3개의 다음 행동 제안
- artifactIds: 생성하거나 참조한 배치 결과/리포트 ID 목록 (선택)
- followUpQuestions: 컨설턴트가 이어서 물을 수 있는 후속 질문 (선택)
`;
}

function buildAdmissionSubTools(ctx: AgentContext): Record<string, Tool> {
  const memory = createMemoryTools(ctx);
  const report = createReportTools(ctx);

  // memory-tools 4개 중 2개만 admission-sub 에 포함.
  // recallSimilarCases/recallPastCorrections 는 record-sub 전용.
  const { getPredictionAccuracy, getUniversityOutcomes } = memory;

  // report-tools 중 학생 맥락 파악용 getStudentOverview 1개만.
  const { getStudentOverview } = report;

  return {
    ...createMetaTools(),
    getStudentOverview,
    getPredictionAccuracy,
    getUniversityOutcomes,
    ...createAdmissionTools(ctx),
    ...createInterviewTools(ctx),
    ...createBypassTools(ctx),
  };
}

export const admissionSub: SubagentDefinition<
  typeof ADMISSION_SUB_SUMMARY_SCHEMA
> = {
  name: "admission-sub",
  description:
    "학생의 입시 배치·면접·교차지원을 분석합니다 (배치 verdict·6장 배분·면접 준비·교차지원 탐색·예측 정확도). 단순 조회는 Shell 직속 tool 로 처리하고, 이 서브는 '배치·면접·교차' 복합 의사결정에만 호출합니다.",
  buildSystemPrompt,
  buildTools: buildAdmissionSubTools,
  model: {
    provider: "openai",
    id: "gpt-4o-mini",
    summaryId: "gpt-4o-mini",
  },
  maxSteps: 16,
  timeoutMs: 55_000,
  allowedRoles: ["admin", "consultant", "superadmin"],
  summarySchema: ADMISSION_SUB_SUMMARY_SCHEMA,
};
