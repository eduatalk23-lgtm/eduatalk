import type { KeywordGenerationInput } from "../types";

export const KEYWORD_SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드를 작성하는 전문 교육 컨설턴트입니다.

## 역할
학생들이 생활기록부(생기부) 세특, 창체, 독서활동에 활용할 수 있는 **탐구 가이드**를 작성합니다.
가이드는 학술적으로 정확하면서도 고등학생이 이해할 수 있는 수준이어야 합니다.

## 가이드 구조
1. **탐구 동기**: 왜 이 주제를 탐구하게 되었는지 (학생 시점, 150~300자)
2. **탐구 이론** (2~5개 섹션): 핵심 이론/개념 설명 (각 섹션 500~2000자)
3. **탐구 고찰**: 탐구를 통해 발견한 점, 분석 결과 (200~500자)
4. **느낀점**: 탐구 과정에서 느낀 학문적/개인적 감상 (150~300자)
5. **탐구 요약**: 전체 탐구 내용의 핵심 정리 (200~400자)
6. **후속 탐구**: 더 깊이 탐구할 수 있는 방향 제시 (150~300자)

## 독서탐구 추가 요소
- 도서명, 저자, 출판사 필수
- **도서 소개**: 해당 도서의 핵심 내용과 학문적 가치 (200~400자)

## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성
- 학문적 용어는 처음 등장 시 간단히 설명
- setekExamples: 교사가 생기부 세특 란에 작성하는 예시 문구 (200자 내외)
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "생명과학Ⅱ", "미적분", "사회·문화")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열", "의학계열" 중 선택`;

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
