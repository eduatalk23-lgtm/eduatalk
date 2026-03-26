import type { GuideDetail, GuideType } from "../../types";
import type { CloneVariantInput, StudentProfileContext } from "../types";
import { resolveContentSections } from "../../section-config";
import { buildBaseSystemPrompt } from "./common-prompt-builder";

const CLONE_SPECIFIC_RULES = `
## 클론 변형 규칙
1. 원본의 섹션 구조를 유지하되, 새로운 관점에서 재해석합니다
2. 이론 섹션은 새로운 관점에서 **완전히 다시 작성** (복붙 금지)
3. 같은 주제라도 다른 학문적 렌즈로 분석합니다 (예: 생물학→화학, 사회→경제)
4. 탐구 동기는 변형 대상 계열/과목에 맞게 재작성합니다
5. 세특 예시도 변형 대상 과목에 맞게 새로 작성합니다`;

/**
 * 클론 변형 시스템 프롬프트 (유형별 섹션 구조 인식)
 */
export function buildCloneSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
): string {
  return `${buildBaseSystemPrompt(guideType, studentProfile)}\n${CLONE_SPECIFIC_RULES}`;
}

// 하위 호환
export const CLONE_SYSTEM_PROMPT = "";

export function buildCloneUserPrompt(
  sourceGuide: GuideDetail,
  input: CloneVariantInput,
): string {
  const lines: string[] = [];

  lines.push(`## 원본 가이드`);
  lines.push(`- **제목**: ${sourceGuide.title}`);
  lines.push(`- **유형**: ${sourceGuide.guide_type}`);

  if (sourceGuide.book_title) {
    lines.push(
      `- **도서**: ${sourceGuide.book_title} (${sourceGuide.book_author ?? "저자 미상"})`,
    );
  }

  // content_sections 우선 사용 (레거시 fallback)
  if (sourceGuide.content) {
    const sections = resolveContentSections(
      sourceGuide.guide_type as GuideType,
      sourceGuide.content,
    );

    if (sections.length > 0) {
      lines.push(`\n### 원본 섹션 내용`);
      for (const s of sections.slice(0, 8)) {
        if (s.key === "setek_examples") continue; // 교사용 제외
        const text = stripHtml(s.content).slice(0, 400);
        if (text) {
          lines.push(`\n**[${s.label}]**\n${text}...`);
        }
      }
    }
  }

  lines.push(`\n## 변형 요청`);
  if (input.targetSubject) {
    lines.push(`- **대상 과목**: ${input.targetSubject}`);
  }
  if (input.targetCareerField) {
    lines.push(`- **대상 계열**: ${input.targetCareerField}`);
  }
  if (input.variationNote) {
    lines.push(`- **변형 방향**: ${input.variationNote}`);
  }

  lines.push(
    `\n위 원본 가이드를 기반으로 새로운 관점의 변형 가이드를 생성해주세요.`,
  );

  return lines.join("\n");
}

/** HTML 태그 제거 (프롬프트 토큰 절약) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
