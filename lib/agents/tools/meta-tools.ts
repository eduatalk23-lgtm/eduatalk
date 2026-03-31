// ============================================
// 메타 도구 — 에이전트 내부 추론 (think)
// 사이드이펙트 없음, 사용자에게 비공개
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentToolResult } from "../types";

/**
 * 메타 도구 생성.
 * ctx 불필요 — 순수 추론 도구로 외부 의존성 없음.
 */
export function createMetaTools() {
  return {
    think: tool({
      description:
        "내부 추론 도구입니다. 복잡한 판단이 필요할 때 생각을 정리하는 데 사용합니다. " +
        "이 도구의 결과는 사용자에게 표시되지 않습니다. " +
        "사용 시점: (1) 여러 도구 결과를 종합할 때, (2) 모순되는 데이터를 발견했을 때, " +
        "(3) 전형 추천처럼 여러 기준을 가중치로 판단해야 할 때. " +
        "단순 질문에는 사용하지 마세요.",
      parameters: z.object({
        situation: z
          .string()
          .describe("현재 파악한 상황 요약"),
        analysis: z
          .string()
          .describe("분석: 강점, 약점, 모순점, 데이터 부족 등"),
        conclusion: z
          .string()
          .describe("판단 결론과 다음 행동 계획"),
      }),
      execute: async (): Promise<AgentToolResult<{ acknowledged: true }>> => {
        return { success: true, data: { acknowledged: true } };
      },
    }),
  };
}
