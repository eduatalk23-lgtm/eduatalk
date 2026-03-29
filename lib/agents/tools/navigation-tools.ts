// ============================================
// 네비게이션 도구 — 에이전트 → UI 액션
// DB/LLM 호출 없음, action descriptor만 반환
// 클라이언트에서 tool result의 action 필드를 해석하여 UI 실행
// ============================================

import { tool } from "ai";
import { z } from "zod";

const SECTION_IDS = [
  "sec-1", "sec-2", "sec-3", "sec-6", "sec-6-volunteer",
  "sec-7", "sec-7-grades", "sec-7-setek", "sec-7-personal",
  "sec-8", "sec-9",
  "sec-diagnosis-analysis", "sec-diagnosis-crossref",
  "sec-diagnosis-overall", "sec-diagnosis-adequacy", "sec-warnings",
  "sec-pipeline-results", "sec-course-plan", "sec-storyline",
  "sec-roadmap", "sec-compensation", "sec-activity-summary",
  "sec-setek-guide", "sec-exploration-guide", "sec-bypass-major",
  "sec-applications", "sec-minscore", "sec-placement",
  "sec-allocation", "sec-interview", "sec-alumni",
] as const;

const LAYER_TABS = ["neis", "draft", "analysis", "guide", "direction", "memo", "chat"] as const;

export function createNavigationTools() {
  return {
    navigateToSection: tool({
      description:
        "사용자를 생기부의 특정 섹션으로 스크롤 이동시킵니다. " +
        "분석 결과를 설명하면서 관련 섹션을 함께 보여줄 때 유용합니다. " +
        "주요 섹션: sec-7-setek(세특), sec-diagnosis-analysis(역량분석), " +
        "sec-storyline(스토리라인), sec-placement(배치분석), sec-interview(면접질문)",
      inputSchema: z.object({
        sectionId: z.string().describe(`섹션 ID: ${SECTION_IDS.join(", ")}`),
        reason: z.string().describe("이동을 제안하는 이유 (한국어, 한 문장)"),
      }),
      execute: async ({ sectionId, reason }) => ({
        success: true,
        action: { type: "navigate_section" as const, sectionId },
        reason,
      }),
    }),

    focusSubject: tool({
      description:
        "특정 과목의 컨텍스트 그리드를 열어 레이어별 상세 비교 뷰를 보여줍니다. " +
        "과목 분석 시 AI초안/컨설턴트가안/확정본을 동시에 비교해야 할 때 사용하세요.",
      inputSchema: z.object({
        subjectName: z.string().describe("과목명 (예: 국어, 수학, 물리학)"),
        schoolYear: z.number().describe("학년도 (예: 2026)"),
        reason: z.string().describe("이 과목을 보여주는 이유 (한국어, 한 문장)"),
      }),
      execute: async ({ subjectName, schoolYear, reason }) => ({
        success: true,
        action: { type: "focus_subject" as const, subjectName, schoolYear },
        reason,
      }),
    }),

    switchLayerTab: tool({
      description:
        "전체 에디터의 레이어 탭을 전환합니다. " +
        "탭 종류: neis(NEIS원문), draft(가안), analysis(분석), " +
        "guide(가이드), direction(방향), memo(메모), chat(논의)",
      inputSchema: z.object({
        tab: z.enum(LAYER_TABS).describe("전환할 탭"),
        reason: z.string().describe("탭 전환 이유 (한국어, 한 문장)"),
      }),
      execute: async ({ tab, reason }) => ({
        success: true,
        action: { type: "navigate_tab" as const, tab },
        reason,
      }),
    }),
  };
}
