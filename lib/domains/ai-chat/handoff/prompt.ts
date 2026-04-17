/**
 * Phase T-4 시스템 프롬프트 조각
 *
 * buildUserContextPrompt() 결과 뒤에 덧붙여 사용.
 * 스니펫은 resolver 가 생성한 한국어 1-3줄. 여기서는 섹션 래핑만.
 */

import type { HandoffSource } from "./sources";
import type { HandoffResolved } from "./validator";

export function buildHandoffPromptSection(
  source: HandoffSource,
  resolved: HandoffResolved,
): string {
  return [
    `[대화 맥락 — GUI 승계]`,
    `- 진입 경로: ${source.originPath}`,
    resolved.snippet,
  ].join("\n");
}
