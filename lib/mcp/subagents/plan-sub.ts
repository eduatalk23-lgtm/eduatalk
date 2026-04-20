/**
 * Phase G S-3-a: plan-sub — 수강 계획 설계 서브에이전트.
 *
 * Shell 직속 tool 로는 불가능한 "수강 계획 설계·적합도 분석·충돌 해결" 흐름을
 * end-to-end 처리. Shell 에서는 `designStudentPlan` MCP tool 로만 노출.
 *
 * 경계안 (Sprint S-0-a 확정):
 *  - record-tools.ts 3개 (getCourseAdequacy / recommendCourses / checkCoursePlanConflicts)
 *  - report-tools.ts 1개 (getStudentOverview) — 학생 맥락 확인용
 *  - guide-tools.ts 1개 (getStudentAssignments) — 기존 탐구·과제 연동 확인용
 *  - meta-tools.ts 1개 (think)
 *  총 6 tool. simulateMinScoreRequirement 는 admission-sub 로 이관(미포함).
 */

import { z } from "zod";
import type { Tool } from "ai";

import type { AgentContext } from "@/lib/agents/types";
import { SCHOOL_CATEGORY_LABELS } from "@/lib/domains/student-record/constants";
import { createRecordTools } from "@/lib/agents/tools/record-tools";
import { createReportTools } from "@/lib/agents/tools/report-tools";
import { createGuideTools } from "@/lib/agents/tools/guide-tools";
import { createMetaTools } from "@/lib/agents/tools/meta-tools";

import type { SubagentDefinition } from "./_shared/subagentTypes";

const PLAN_SUB_SUMMARY_SCHEMA = z.object({
  headline: z
    .string()
    .min(4)
    .max(200)
    .describe("1문장 핵심 결론 (예: '2학년 2학기 경제·수학2 충돌 해결이 1순위')"),
  adequacyScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("교과이수적합도 0~100. getCourseAdequacy 결과가 있을 때만 포함"),
  keyFindings: z
    .array(z.string().min(4).max(240))
    .max(5)
    .describe("주요 발견 최대 5건. 적합도/충돌/추천 근거를 구체적으로 서술"),
  conflicts: z
    .array(z.string().min(4).max(200))
    .max(5)
    .describe(
      "발견된 수강 계획 충돌 목록 (과부하·미개설·중복·선수과목 위반 등). 없으면 빈 배열",
    ),
  recommendedCourses: z
    .array(z.string().min(1).max(120))
    .max(10)
    .describe("추천 과목 이름 상위 목록. 호출하지 않았으면 빈 배열"),
  recommendedActions: z
    .array(z.string().min(4).max(200))
    .max(3)
    .describe("컨설턴트가 취할 다음 행동 최대 3건"),
  artifactIds: z
    .array(z.string())
    .max(5)
    .describe("Shell 이 열 수 있는 artifact id 목록 (예: plan:UUID). 없으면 빈 배열"),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("컨설턴트가 다음 턴에 물어볼 만한 질문 후보 (선택)"),
});

export type PlanSubSummary = z.infer<typeof PLAN_SUB_SUMMARY_SCHEMA>;

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
  return `당신은 수강 계획 설계 전문 서브에이전트 (plan-sub)입니다. Shell 오케스트레이터가 단순 조회로 해결할 수 없는 "수강 계획 설계·적합도 분석·충돌 해결" 요청을 위임받아 end-to-end 로 처리합니다. 3학년 과목 선택·이수 단위·선이수 조건 점검에 특화.

## 현재 학생 정보
${buildStudentInfoSection(ctx)}

## 역할 규율
1. **맥락 → 분석 → 생성 순서**: 설계 전 반드시 getStudentOverview 로 희망 전공·학년을 확인하고, 필요 시 getStudentAssignments 로 탐구 흐름을 점검하세요.
2. **적합도 평가**: 전공 계열이 명확하면 getCourseAdequacy 를 호출해 정량 점수를 확보하세요. 점수 없이 추측 금지.
3. **추천 → 충돌 검사 순서**: recommendCourses 는 DB 를 덮어씁니다. 호출하려면 위임 input 에 "추천 생성", "재추천", "수강 계획 작성" 등 명시가 있을 때만. 이후 반드시 checkCoursePlanConflicts 로 충돌을 점검.
4. **충돌 해결 제안**: checkCoursePlanConflicts 결과에 conflicts 가 있으면 가장 시급한 것부터 recommendedActions 에 해결 방안을 서술.
5. **tool 호출 최소화**: 같은 질문에 동일 tool 을 2회 이상 호출하지 마세요. 3~6개 tool 조합으로 대부분 해결.
6. **think 활용 기준**: 3개 이상 tool 을 조합하거나 모순된 결과가 나왔을 때만 think. 단순 단계엔 금지.
7. **데이터 부족 시 투명하게 보고**: 전공·학년 정보가 없으면 추측하지 말고 keyFindings 에 "데이터 부족: ..." 으로 명시하고 recommendedActions 로 수집 방법을 제안.
8. **한국어 응답**: 모든 reasoning·최종 답변은 한국어.

## 최종 출력 규칙
마지막 assistant 메시지는 **요약 텍스트**를 자유 형식으로 쓰되, Shell 이 이어받을 구조화 요약 (summarySchema) 에 필요한 다음 정보를 반드시 포함하세요:
- headline: 1문장 핵심 결론
- adequacyScore: getCourseAdequacy 를 호출했을 때만 0~100 점수
- keyFindings: 최대 5개의 구체적 발견 (근거 포함)
- conflicts: 발견된 수강 계획 충돌. 없으면 빈 배열
- recommendedCourses: 추천 과목 상위 이름. 호출하지 않았으면 빈 배열
- recommendedActions: 최대 3개의 다음 행동 제안
- artifactIds: 생성하거나 참조한 계획/리포트 ID 목록 (선택)
- followUpQuestions: 컨설턴트가 이어서 물을 수 있는 후속 질문 (선택)
`;
}

function buildPlanSubTools(ctx: AgentContext): Record<string, Tool> {
  const record = createRecordTools(ctx);
  const report = createReportTools(ctx);
  const guide = createGuideTools(ctx);

  // 필요한 3 tool 만 record 에서 추출 — admission 전용(simulateMinScoreRequirement) 은 제외.
  const { getCourseAdequacy, recommendCourses, checkCoursePlanConflicts } =
    record;
  const { getStudentOverview } = report;
  const { getStudentAssignments } = guide;

  return {
    ...createMetaTools(),
    getStudentOverview,
    getStudentAssignments,
    getCourseAdequacy,
    recommendCourses,
    checkCoursePlanConflicts,
  };
}

export const planSub: SubagentDefinition<typeof PLAN_SUB_SUMMARY_SCHEMA> = {
  name: "plan-sub",
  description:
    "학생 수강 계획을 설계합니다 (교과이수적합도·추천 과목·충돌 검사). 단순 조회는 Shell 직속 tool 로 처리하고, 이 서브는 '계획 설계·적합도 분석·충돌 해결' 요청에만 호출합니다.",
  buildSystemPrompt,
  buildTools: buildPlanSubTools,
  model: {
    provider: "openai",
    id: "gpt-4o-mini",
    summaryId: "gpt-4o-mini",
  },
  maxSteps: 8,
  timeoutMs: 40_000,
  allowedRoles: ["admin", "consultant", "superadmin"],
  summarySchema: PLAN_SUB_SUMMARY_SCHEMA,
};
