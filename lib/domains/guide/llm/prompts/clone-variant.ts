import type { GuideDetail } from "../../types";
import type { CloneVariantInput } from "../types";

export const CLONE_SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드를 작성하는 전문 교육 컨설턴트입니다.

## 역할
기존 탐구 가이드를 기반으로 **새로운 관점의 변형 가이드**를 작성합니다.
원본의 주제와 학술적 깊이를 유지하되, 다른 교과/계열 관점에서 재해석합니다.

## 변형 규칙
1. 원본 구조(동기→이론→고찰→느낀점→요약→후속)를 유지
2. 이론 섹션은 새로운 관점에서 **완전히 다시 작성** (복붙 금지)
3. 같은 주제라도 다른 학문적 렌즈로 분석 (예: 생물학→화학, 사회→경제)
4. 탐구 동기는 변형 대상 계열/과목에 맞게 재작성
5. 세특 예시도 변형 대상 과목에 맞게 새로 작성

## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "화학Ⅱ", "미적분")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열", "의학계열" 중 선택
- suggestedClassifications: 관련 KEDI 학과 소분류명 (예: "전산학ㆍ컴퓨터공학", "경영학", "물리학"). 확실한 것만 최대 5개. 모르면 빈 배열.`;

export function buildCloneUserPrompt(
  sourceGuide: GuideDetail,
  input: CloneVariantInput,
): string {
  const lines: string[] = [];

  lines.push(`## 원본 가이드`);
  lines.push(`- **제목**: ${sourceGuide.title}`);
  lines.push(`- **유형**: ${sourceGuide.guide_type}`);

  if (sourceGuide.book_title) {
    lines.push(`- **도서**: ${sourceGuide.book_title} (${sourceGuide.book_author ?? "저자 미상"})`);
  }

  if (sourceGuide.content) {
    const c = sourceGuide.content;
    if (c.motivation) {
      lines.push(`\n### 원본 탐구 동기\n${stripHtml(c.motivation).slice(0, 500)}`);
    }
    if (c.theory_sections.length > 0) {
      lines.push(`\n### 원본 이론 섹션`);
      for (const s of c.theory_sections.slice(0, 3)) {
        lines.push(`- **${s.title}**: ${stripHtml(s.content).slice(0, 300)}...`);
      }
    }
    if (c.summary) {
      lines.push(`\n### 원본 탐구 요약\n${stripHtml(c.summary).slice(0, 300)}`);
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

  lines.push(`\n위 원본 가이드를 기반으로 새로운 관점의 변형 가이드를 생성해주세요.`);

  return lines.join("\n");
}

/** HTML 태그 제거 (프롬프트 토큰 절약) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
