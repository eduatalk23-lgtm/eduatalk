/**
 * AI 메타데이터 추출 프롬프트
 *
 * 교재/강의 제목에서 메타데이터를 추론하기 위한 프롬프트
 */

import type { ContentType, ExtractedMetadata } from "../types";

// ============================================
// 시스템 프롬프트
// ============================================

export const METADATA_EXTRACTION_SYSTEM_PROMPT = `당신은 한국 고등학교 교육과정 전문가입니다.
교재 또는 강의 제목을 분석하여 메타데이터를 추론합니다.

## 과목 분류 체계

### 과목 카테고리 (subjectCategory)
- **국어**: 국어, 문학, 독서, 화법과작문, 언어와매체
- **수학**: 수학, 수학I, 수학II, 미적분, 확률과통계, 기하
- **영어**: 영어, 영어I, 영어II, 영어독해와작문, 영어회화
- **과학탐구**: 물리학I/II, 화학I/II, 생명과학I/II, 지구과학I/II
- **사회탐구**: 한국지리, 세계지리, 동아시아사, 세계사, 정치와법, 경제, 사회문화, 생활과윤리, 윤리와사상
- **한국사**: 한국사
- **제2외국어/한문**: 일본어, 중국어, 독일어, 프랑스어, 스페인어, 한문

### 과목 (subject) - 구체적인 과목명
예: "수학I", "물리학II", "생활과윤리", "영어독해"

## 난이도 기준

| 키워드/패턴 | 난이도 |
|------------|-------|
| 기초, 입문, 개념, 쎈기초, 라이트 | easy |
| 기본, 정석, 쎈, 개념원리, 자습서 | medium |
| 심화, 하이탑, 블랙라벨, 일등급, 킬러 | hard |

## 교육과정

- **2015개정**: 현행 교육과정 (대부분의 현재 교재)
- **2022개정**: 2025년부터 순차 적용

## 강의 유형 (강의만 해당)

- **concept**: 개념완성, 기본개념, 개념정리
- **problem**: 문제풀이, 기출분석, 문제유형
- **review**: 복습, 정리, 총정리
- **exam_prep**: 수능대비, 모의고사, 시험대비
- **intensive**: 특강, 단기완성, 파이널

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요. 추가 설명 없이 JSON만 출력합니다.

\`\`\`json
{
  "subject": "수학I",
  "subjectConfidence": 0.95,
  "subjectCategory": "수학",
  "subjectCategoryConfidence": 0.98,
  "difficulty": "medium",
  "difficultyConfidence": 0.85,
  "gradeLevel": ["고1", "고2"],
  "gradeLevelConfidence": 0.80,
  "curriculum": "2015",
  "curriculumConfidence": 0.75,
  "lectureType": null,
  "lectureTypeConfidence": 0,
  "instructorName": null,
  "reasoning": "제목에 '정석'이 포함되어 기본서로 판단, '수학I'이 명시되어 있어 과목 확정"
}
\`\`\`

## 주의사항

1. **확신도(confidence)는 0~1 사이 값**
   - 0.9 이상: 제목에 명확히 표시됨
   - 0.7~0.9: 강한 추론 가능
   - 0.5~0.7: 패턴 기반 추론
   - 0.5 미만: 불확실한 추론

2. **정보가 불분명한 경우 null 반환** (낮은 확신도보다 null이 좋음)

3. **reasoning은 한국어로 간결하게** (50자 이내)

4. **강의가 아닌 경우 lectureType, lectureTypeConfidence는 null/0**

5. **출판사/플랫폼 정보가 있으면 난이도 추론에 활용**
   - 좋은책신사고 하이탑 → hard
   - 개념원리 → medium
   - 쎈기초 → easy
`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

/**
 * 메타데이터 추출 사용자 프롬프트 생성
 */
export function buildMetadataExtractionPrompt(
  title: string,
  contentType: ContentType,
  publisher?: string,
  additionalContext?: string
): string {
  const typeLabel = contentType === "book" ? "교재" : "강의";

  let prompt = `다음 ${typeLabel} 제목을 분석하세요:\n\n`;
  prompt += `제목: "${title}"\n`;
  prompt += `콘텐츠 유형: ${typeLabel}\n`;

  if (publisher) {
    prompt += `출판사/플랫폼: ${publisher}\n`;
  }

  if (additionalContext) {
    prompt += `추가 정보: ${additionalContext}\n`;
  }

  prompt += `\n위 정보를 바탕으로 메타데이터를 JSON 형식으로 추출하세요.`;

  return prompt;
}

// ============================================
// 응답 파싱
// ============================================

/**
 * AI 응답에서 JSON 추출
 */
export function parseMetadataResponse(response: string): ExtractedMetadata | null {
  try {
    // JSON 블록 추출 (```json ... ``` 또는 { ... })
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.error("[parseMetadataResponse] JSON not found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[1]);

    // 필수 필드 검증
    if (typeof parsed.subjectConfidence !== "number" ||
        typeof parsed.reasoning !== "string") {
      console.error("[parseMetadataResponse] Missing required fields");
      return null;
    }

    // 타입 정규화
    return {
      subject: parsed.subject ?? null,
      subjectConfidence: Math.min(1, Math.max(0, parsed.subjectConfidence)),
      subjectCategory: parsed.subjectCategory ?? null,
      subjectCategoryConfidence: Math.min(1, Math.max(0, parsed.subjectCategoryConfidence ?? 0)),
      difficulty: validateDifficulty(parsed.difficulty),
      difficultyConfidence: Math.min(1, Math.max(0, parsed.difficultyConfidence ?? 0)),
      gradeLevel: Array.isArray(parsed.gradeLevel) ? parsed.gradeLevel : [],
      gradeLevelConfidence: Math.min(1, Math.max(0, parsed.gradeLevelConfidence ?? 0)),
      curriculum: parsed.curriculum ?? null,
      curriculumConfidence: Math.min(1, Math.max(0, parsed.curriculumConfidence ?? 0)),
      lectureType: validateLectureType(parsed.lectureType),
      lectureTypeConfidence: Math.min(1, Math.max(0, parsed.lectureTypeConfidence ?? 0)),
      instructorName: parsed.instructorName ?? null,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error("[parseMetadataResponse] Parse error:", error);
    return null;
  }
}

function validateDifficulty(value: unknown): "easy" | "medium" | "hard" | null {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return null;
}

function validateLectureType(
  value: unknown
): "concept" | "problem" | "review" | "exam_prep" | "intensive" | null {
  const validTypes = ["concept", "problem", "review", "exam_prep", "intensive"];
  if (typeof value === "string" && validTypes.includes(value)) {
    return value as "concept" | "problem" | "review" | "exam_prep" | "intensive";
  }
  return null;
}

// ============================================
// 토큰 추정
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimateMetadataExtractionTokens(
  title: string,
  contentType: ContentType,
  publisher?: string
): { systemTokens: number; userTokens: number; totalTokens: number } {
  const userPrompt = buildMetadataExtractionPrompt(title, contentType, publisher);

  // 한글 문자 수 계산
  const countKorean = (text: string) =>
    (text.match(/[가-힣]/g) || []).length;

  const estimateTokens = (text: string) => {
    const korean = countKorean(text);
    const other = text.length - korean;
    return Math.ceil(korean * 1.5 + other * 0.25);
  };

  const systemTokens = estimateTokens(METADATA_EXTRACTION_SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
  };
}
