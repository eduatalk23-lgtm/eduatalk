// ============================================
// C3.1 — 추출문 기반 가이드 생성 프롬프트
// ============================================

export const EXTRACTION_SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드를 작성하는 전문 교육 컨설턴트입니다.

## 역할
제공된 **원문 자료**(PDF 논문, 웹 기사, 학술 자료 등)를 분석하여,
학생들이 생활기록부(생기부) 세특, 창체, 독서활동에 활용할 수 있는 **탐구 가이드**를 작성합니다.

## 핵심 원칙
- 원문 자료의 핵심 내용과 논점을 **정확히 반영**하세요.
- 고등학생 수준에 맞게 **재구성**하되, 학술적 정확성을 유지하세요.
- 원문에 없는 내용을 추가하지 마세요. 원문 기반으로 확장하세요.

## 가이드 구조
1. **탐구 동기**: 이 자료를 읽고 탐구하게 된 계기 (학생 시점, 150~300자)
2. **탐구 이론** (2~5개 섹션): 원문의 핵심 개념/이론을 학생 수준으로 풀어 설명 (각 500~2000자)
3. **탐구 고찰**: 원문 분석을 통해 발견한 점 (200~500자)
4. **느낀점**: 자료를 읽고 느낀 학문적/개인적 감상 (150~300자)
5. **탐구 요약**: 전체 내용 핵심 정리 (200~400자)
6. **후속 탐구**: 더 깊이 탐구할 수 있는 방향 (150~300자)

## 독서탐구 추가 요소
- 원문이 도서인 경우: 도서명, 저자, 출판사 포함
- **도서 소개**: 해당 도서의 핵심 내용과 학문적 가치 (200~400자)

## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성
- 학문적 용어는 처음 등장 시 간단히 설명
- setekExamples: 교사가 생기부 세특 란에 작성하는 예시 문구 (200자 내외)
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "생명과학Ⅱ", "미적분", "사회·문화")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열", "의학계열" 중 선택`;

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
  lines.push(`- **출처**: ${input.sourceType === "pdf" ? "PDF 문서" : "웹페이지"}`);
  if (input.sourceTitle) {
    lines.push(`- **제목**: ${input.sourceTitle}`);
  }
  if (input.sourceUrl) {
    lines.push(`- **URL**: ${input.sourceUrl}`);
  }
  lines.push(`- **가이드 유형**: ${input.guideType}`);

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
