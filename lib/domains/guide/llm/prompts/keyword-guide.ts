import type { KeywordGenerationInput } from "../types";
import type { GuideType } from "../../types";
import { GUIDE_TYPE_LABELS } from "../../types";
import { GUIDE_SECTION_CONFIG } from "../../section-config";

/**
 * Config 기반 유형별 섹션 구조를 프롬프트 텍스트로 변환
 */
function buildSectionStructurePrompt(guideType: GuideType): string {
  const defs = GUIDE_SECTION_CONFIG[guideType] ?? GUIDE_SECTION_CONFIG["topic_exploration"];

  const lines: string[] = [];
  lines.push(`## 가이드 구조 (${GUIDE_TYPE_LABELS[guideType]})`);

  for (const def of defs) {
    const reqTag = def.required ? "(필수)" : "(선택)";
    const lengthHint =
      def.minLength && def.maxLength
        ? ` ${def.minLength}~${def.maxLength}자`
        : def.maxLength
          ? ` ~${def.maxLength}자`
          : "";
    const multiHint =
      def.multiple && def.multipleMin && def.multipleMax
        ? ` (${def.multipleMin}~${def.multipleMax}개 섹션)`
        : "";
    const desc = def.placeholder ? ` — ${def.placeholder}` : "";

    lines.push(
      `- **${def.label}** ${reqTag}${multiHint}${lengthHint}${desc}`,
    );
  }

  return lines.join("\n");
}

export const KEYWORD_SYSTEM_PROMPT_BASE = `당신은 한국 고등학교 탐구 가이드를 작성하는 전문 교육 컨설턴트입니다.

## 역할
학생들이 생활기록부(생기부) 세특, 창체, 독서활동에 활용할 수 있는 **탐구 가이드**를 작성합니다.
가이드는 학술적으로 정확하면서도 고등학생이 이해할 수 있는 수준이어야 합니다.

## 독서탐구 추가 요소
- 도서명, 저자, 출판사 필수
- **도서 소개**: 해당 도서의 핵심 내용과 학문적 가치 (200~400자)

## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성
- 학문적 용어는 처음 등장 시 간단히 설명
- **theorySections의 title을 아래 가이드 구조의 섹션명으로 사용** (예: 실험탐구일 때 "실험 목적", "배경 이론", "실험 재료 및 기구", "실험 방법", "실험 결과", "결과 분석" 등)
- setekExamples: 교사가 생기부 세특 란에 작성하는 예시 문구 (200자 내외)
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "생명과학Ⅱ", "미적분", "사회·문화")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열" 중 선택
- suggestedClassifications: 관련 KEDI 학과 소분류명. 확실한 것만 최대 5개. 모르면 빈 배열.`;

/**
 * 유형별 시스템 프롬프트 생성 (config 기반)
 */
export function buildKeywordSystemPrompt(guideType: GuideType): string {
  const structure = buildSectionStructurePrompt(guideType);
  return `${KEYWORD_SYSTEM_PROMPT_BASE}\n\n${structure}`;
}

// 하위 호환: 기존 코드에서 KEYWORD_SYSTEM_PROMPT를 참조하는 곳용
export const KEYWORD_SYSTEM_PROMPT = KEYWORD_SYSTEM_PROMPT_BASE;

export function buildKeywordUserPrompt(input: KeywordGenerationInput): string {
  const lines: string[] = [];

  lines.push(`## 생성 요청`);
  lines.push(`- **키워드/주제**: ${input.keyword}`);
  lines.push(`- **가이드 유형**: ${input.guideType}`);

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
