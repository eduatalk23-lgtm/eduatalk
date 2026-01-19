/**
 * Stage 7: 마크다운 출력
 *
 * 생성된 플랜을 마크다운 형식으로 출력합니다.
 */

import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  ValidatedPlanInput,
  ContentResolutionResult,
  StageResult,
} from "../types";
import { buildMarkdownExportData, renderMarkdown } from "../utils/markdownHelpers";

/**
 * Stage 7: 마크다운 출력
 *
 * @param input - 검증된 입력 데이터
 * @param plans - 생성된 플랜 목록
 * @param contentResolution - 콘텐츠 해결 결과
 * @returns 마크다운 문자열 또는 에러
 */
export function exportMarkdown(
  input: ValidatedPlanInput,
  plans: ScheduledPlan[],
  contentResolution: ContentResolutionResult
): StageResult<string> {
  // 마크다운 생성이 비활성화된 경우
  if (!input.generationOptions.generateMarkdown) {
    return {
      success: true,
      data: "",
    };
  }

  // 플랜이 없는 경우
  if (plans.length === 0) {
    return {
      success: false,
      error: "마크다운을 생성할 플랜이 없습니다",
    };
  }

  // 마크다운 데이터 빌드
  const exportData = buildMarkdownExportData(
    input.planName,
    input.periodStart,
    input.periodEnd,
    input.planPurpose,
    plans,
    contentResolution.items
  );

  // 마크다운 렌더링
  const markdown = renderMarkdown(exportData);

  return { success: true, data: markdown };
}
