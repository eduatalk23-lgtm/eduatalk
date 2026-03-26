import type { KeywordGenerationInput, StudentProfileContext } from "../types";
import type { GuideType } from "../../types";
import { GUIDE_TYPE_LABELS } from "../../types";
import { buildBaseSystemPrompt } from "./common-prompt-builder";

/**
 * 키워드 기반 가이드 생성 프롬프트
 *
 * 시스템 프롬프트: buildBaseSystemPrompt (공통 빌더) 사용
 * 유저 프롬프트: 키워드 + 유형 + 과목 + 계열 + 추가 맥락
 */

/**
 * 유형별 시스템 프롬프트 생성 (공통 빌더 기반)
 */
export function buildKeywordSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
  selectedSectionKeys?: string[],
): string {
  return buildBaseSystemPrompt(guideType, studentProfile, selectedSectionKeys);
}

// 하위 호환: 기존 코드에서 참조하는 곳용
export const KEYWORD_SYSTEM_PROMPT_BASE = "";
export const KEYWORD_SYSTEM_PROMPT = "";

export function buildKeywordUserPrompt(input: KeywordGenerationInput): string {
  const lines: string[] = [];

  lines.push(`## 생성 요청`);
  lines.push(`- **키워드/주제**: ${input.keyword}`);
  lines.push(
    `- **가이드 유형**: ${GUIDE_TYPE_LABELS[input.guideType] ?? input.guideType}`,
  );

  if (input.targetSubject) {
    lines.push(`- **관련 과목**: ${input.targetSubject}`);
  }
  if (input.targetCareerField) {
    lines.push(`- **관련 계열**: ${input.targetCareerField}`);
  }
  if (input.additionalContext) {
    lines.push(`\n## 추가 요청사항\n${input.additionalContext}`);
  }

  lines.push(`\n위 정보를 바탕으로 탐구 가이드를 생성해주세요.`);

  return lines.join("\n");
}
