// ============================================
// C3.1 — 추출문 기반 가이드 생성 프롬프트
// 공통 빌더 기반으로 유형별 섹션 구조 인식
// ============================================

import type { GuideType } from "../../types";
import { GUIDE_TYPE_LABELS } from "../../types";
import type { StudentProfileContext } from "../types";
import { buildBaseSystemPrompt } from "./common-prompt-builder";

const EXTRACTION_SPECIFIC_RULES = `
## 추출 원문 기반 작성 원칙
- 원문 자료의 핵심 내용과 논점을 **정확히 반영**합니다
- 고등학생 수준에 맞게 **재구성**하되, 학술적 정확성을 유지합니다
- 원문에 없는 내용을 추가하지 않습니다. 원문 기반으로 확장합니다
- 원문이 도서인 경우: 도서명(bookTitle), 저자(bookAuthor), 출판사(bookPublisher)를 반드시 포함합니다`;

/**
 * 추출 기반 시스템 프롬프트 (유형별 섹션 구조 인식)
 */
export function buildExtractionSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
  selectedSectionKeys?: string[],
): string {
  return `${buildBaseSystemPrompt(guideType, studentProfile, selectedSectionKeys)}\n${EXTRACTION_SPECIFIC_RULES}`;
}

// 하위 호환: 기존 코드에서 참조하는 곳용
export const EXTRACTION_SYSTEM_PROMPT = "";

export interface ExtractionGuideInput {
  /** 추출된 원문 텍스트 */
  extractedText: string;
  /** 원문 제목 (PDF 메타 또는 페이지 타이틀) */
  sourceTitle?: string;
  /** 원문 URL */
  sourceUrl?: string;
  /** 소스 유형 */
  sourceType: "pdf" | "url";
  /** 가이드 유형 */
  guideType: string;
  /** 관련 과목 */
  targetSubject?: string;
  /** 관련 계열 */
  targetCareerField?: string;
  /** 추가 요청사항 */
  additionalContext?: string;
}

export function buildExtractionUserPrompt(
  input: ExtractionGuideInput,
): string {
  const lines: string[] = [];

  lines.push(`## 원문 자료 정보`);
  lines.push(
    `- **출처**: ${input.sourceType === "pdf" ? "PDF 문서" : "웹페이지"}`,
  );
  if (input.sourceTitle) {
    lines.push(`- **제목**: ${input.sourceTitle}`);
  }
  if (input.sourceUrl) {
    lines.push(`- **URL**: ${input.sourceUrl}`);
  }
  lines.push(
    `- **가이드 유형**: ${GUIDE_TYPE_LABELS[input.guideType as GuideType] ?? input.guideType}`,
  );

  if (input.targetSubject) {
    lines.push(`- **관련 과목**: ${input.targetSubject}`);
  }
  if (input.targetCareerField) {
    lines.push(`- **관련 계열**: ${input.targetCareerField}`);
  }

  lines.push(`\n## 원문 내용\n\n${input.extractedText}`);

  if (input.additionalContext) {
    lines.push(`\n## 추가 요청사항\n${input.additionalContext}`);
  }

  lines.push(
    `\n위 원문 자료를 바탕으로 고등학생용 탐구 가이드를 생성해주세요.`,
  );

  return lines.join("\n");
}
