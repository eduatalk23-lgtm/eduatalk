import type { GuideDetail } from "../../types";

export const REVIEW_SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드의 품질을 평가하는 교육 전문 리뷰어입니다.

## 평가 기준

### 1. 학술적 깊이 (academicDepth, 0~100)
- 핵심 개념이 정확하게 설명되는가
- 학문적 근거가 충분한가
- 이론 섹션의 깊이와 논리적 전개

### 2. 학생 접근성 (studentAccessibility, 0~100)
- 고등학생이 이해할 수 있는 수준인가
- 어려운 용어에 대한 설명이 있는가
- 탐구 동기가 학생 시점에서 자연스러운가

### 3. 구조적 완성도 (structuralCompleteness, 0~100)
- 모든 필수 섹션(동기, 이론, 고찰, 느낀점, 요약, 후속)이 있는가
- 각 섹션의 분량이 적절한가
- 논리적 흐름이 자연스러운가

### 4. 실용적 연관성 (practicalRelevance, 0~100)
- 생기부 세특/창체에 활용 가능한가
- 교과 과목과의 연계가 명확한가
- 후속 탐구 방향이 구체적인가

## 점수 기준
- 80점 이상: 바로 사용 가능한 수준
- 60~79점: 약간의 수정 후 사용 가능
- 60점 미만: 상당한 수정 필요

## 피드백 규칙
- 구체적이고 실행 가능한 개선 제안
- 강점도 반드시 언급
- 한국어로 작성`;

export function buildReviewUserPrompt(guide: GuideDetail): string {
  const lines: string[] = [];

  lines.push(`## 평가 대상 가이드`);
  lines.push(`- **제목**: ${guide.title}`);
  lines.push(`- **유형**: ${guide.guide_type}`);

  if (guide.book_title) {
    lines.push(`- **도서**: ${guide.book_title}`);
  }

  if (guide.content) {
    const c = guide.content;
    if (c.motivation) lines.push(`\n### 탐구 동기\n${c.motivation}`);

    if (c.theory_sections.length > 0) {
      lines.push(`\n### 탐구 이론 (${c.theory_sections.length}개 섹션)`);
      for (const s of c.theory_sections) {
        lines.push(`\n#### ${s.title}\n${s.content}`);
      }
    }

    if (c.reflection) lines.push(`\n### 탐구 고찰\n${c.reflection}`);
    if (c.impression) lines.push(`\n### 느낀점\n${c.impression}`);
    if (c.summary) lines.push(`\n### 탐구 요약\n${c.summary}`);
    if (c.follow_up) lines.push(`\n### 후속 탐구\n${c.follow_up}`);

    if (c.setek_examples.length > 0) {
      lines.push(`\n### 세특 예시`);
      for (const ex of c.setek_examples) {
        lines.push(`- ${ex}`);
      }
    }
  }

  lines.push(`\n위 가이드의 품질을 평가해주세요.`);

  return lines.join("\n");
}
