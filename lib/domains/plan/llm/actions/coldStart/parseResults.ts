/**
 * Task 4: 결과 파싱
 *
 * 이 파일은 AI가 반환한 텍스트를 구조화된 객체로 변환합니다.
 *
 * 📥 INPUT:  AI 응답 텍스트 (Task 3의 결과)
 * 📤 OUTPUT: 파싱된 콘텐츠 목록 (ParsedContentItem[])
 *
 * 파싱 과정:
 * 1. 마크다운 코드 블록 제거 (```json ... ```)
 * 2. JSON.parse()로 파싱
 * 3. results 배열 추출
 * 4. 각 항목을 ParsedContentItem으로 변환
 * 5. 필수 필드 검증 (title, totalRange)
 */

import type {
  ParseResultsResult,
  ParsedContentItem,
  ChapterInfo,
  ContentType,
} from "./types";

/**
 * AI 응답을 파싱하여 콘텐츠 목록으로 변환합니다.
 *
 * AI 응답은 JSON 형식이지만, 마크다운 코드 블록으로 감싸져 있을 수 있습니다.
 * 이 함수는 다양한 형식의 응답을 처리할 수 있습니다.
 *
 * @param rawContent - AI가 반환한 원본 텍스트
 * @returns 파싱 결과 (성공 시 items, 실패 시 error)
 *
 * @example
 * const result = parseSearchResults(`{
 *   "results": [{
 *     "title": "개념원리 미적분",
 *     "contentType": "book",
 *     "totalRange": 320,
 *     "chapters": [...]
 *   }]
 * }`);
 *
 * if (result.success) {
 *   console.log("파싱된 항목:", result.items.length);
 * }
 */
export function parseSearchResults(rawContent: string): ParseResultsResult {
  // ────────────────────────────────────────────────────────────────────
  // 1단계: 입력 검증
  // ────────────────────────────────────────────────────────────────────

  if (!rawContent || rawContent.trim() === "") {
    return {
      success: false,
      error: "파싱할 내용이 비어있습니다",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 2단계: 마크다운 코드 블록 제거
  // ────────────────────────────────────────────────────────────────────

  const cleanedContent = cleanJsonString(rawContent);

  // ────────────────────────────────────────────────────────────────────
  // 3단계: JSON 파싱
  // ────────────────────────────────────────────────────────────────────

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanedContent);
  } catch {
    // 먼저 잘린 JSON 복구 시도
    const repairedCleaned = repairTruncatedJson(cleanedContent);
    if (repairedCleaned) {
      try {
        parsed = JSON.parse(repairedCleaned);
      } catch {
        // 다음 단계로 진행
      }
    }
  }

  // 아직 파싱되지 않았으면 다른 방법 시도
  if (parsed === undefined) {
    // JSON 파싱 실패 시, 부분적으로 JSON을 추출 시도
    const extractedJson = extractJsonFromText(rawContent);

    if (extractedJson) {
      try {
        parsed = JSON.parse(extractedJson);
      } catch {
        // 잘린 JSON 복구 시도
        const repairedJson = repairTruncatedJson(extractedJson);
        if (repairedJson) {
          try {
            parsed = JSON.parse(repairedJson);
          } catch {
            return {
              success: false,
              error: "JSON 파싱에 실패했습니다. AI 응답 형식이 올바르지 않습니다.",
            };
          }
        } else {
          return {
            success: false,
            error: "JSON 파싱에 실패했습니다. AI 응답 형식이 올바르지 않습니다.",
          };
        }
      }
    } else {
      return {
        success: false,
        error: "JSON 파싱에 실패했습니다. AI 응답에서 JSON을 찾을 수 없습니다.",
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 4단계: results 배열 추출
  // ────────────────────────────────────────────────────────────────────

  const rawResults = extractResultsArray(parsed);

  if (!rawResults) {
    return {
      success: false,
      error: "응답에서 results 배열을 찾을 수 없습니다",
    };
  }

  if (rawResults.length === 0) {
    return {
      success: false,
      error: "검색 결과가 없습니다",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 5단계: 각 항목을 ParsedContentItem으로 변환
  // ────────────────────────────────────────────────────────────────────

  const items: ParsedContentItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const rawItem = rawResults[i];
    const converted = convertToContentItem(rawItem, i);

    if (converted.success) {
      items.push(converted.item);
    } else {
      errors.push(converted.error);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 6단계: 결과 반환
  // ────────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return {
      success: false,
      error: `모든 항목 변환에 실패했습니다: ${errors.join(", ")}`,
    };
  }

  // 일부 실패해도 성공한 항목이 있으면 성공으로 처리
  if (errors.length > 0) {
    console.warn(
      `[parseResults] ${errors.length}개 항목 변환 실패:`,
      errors
    );
  }

  return {
    success: true,
    items,
  };
}

// ============================================================================
// 헬퍼 함수들
// ============================================================================

/**
 * JSON 문자열에서 마크다운 코드 블록을 제거합니다.
 *
 * AI 응답이 다음과 같은 형식일 수 있습니다:
 * - ```json { ... } ```
 * - ``` { ... } ```
 * - { ... } (이미 순수 JSON)
 */
function cleanJsonString(input: string): string {
  let cleaned = input.trim();

  // ```json 또는 ``` 블록 제거
  // 패턴: ```json ... ``` 또는 ``` ... ```
  const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
  const match = cleaned.match(codeBlockRegex);

  if (match) {
    cleaned = match[1].trim();
  }

  // 앞뒤 ```만 있는 경우 제거
  cleaned = cleaned.replace(/^```(?:json)?/g, "").replace(/```$/g, "").trim();

  return cleaned;
}

/**
 * 텍스트에서 JSON 객체를 추출합니다.
 *
 * AI가 JSON 외에 설명 텍스트를 함께 반환한 경우,
 * { } 또는 [ ] 로 둘러싸인 부분만 추출합니다.
 */
function extractJsonFromText(text: string): string | null {
  // { ... } 패턴 찾기 (중첩된 {} 포함)
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  // [ ... ] 패턴 찾기
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    // 배열을 results로 감싸기
    return `{"results": ${arrayMatch[0]}}`;
  }

  return null;
}

/**
 * 잘린 JSON을 복구합니다.
 *
 * AI 응답이 토큰 한도로 인해 중간에 끊긴 경우,
 * 누락된 닫는 괄호를 추가하여 파싱 가능한 JSON으로 복구합니다.
 *
 * @param json - 잘렸을 수 있는 JSON 문자열
 * @returns 복구된 JSON 문자열 또는 null
 */
function repairTruncatedJson(json: string): string | null {
  // 이미 유효한 JSON인지 확인
  try {
    JSON.parse(json);
    return json;
  } catch {
    // 복구 시도
  }

  // 열린 괄호와 닫힌 괄호 개수 세기
  let braceCount = 0; // { }
  let bracketCount = 0; // [ ]
  let inString = false;
  let escapeNext = false;

  for (const char of json) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") braceCount++;
    else if (char === "}") braceCount--;
    else if (char === "[") bracketCount++;
    else if (char === "]") bracketCount--;
  }

  // 닫힌 문자열이 없는 경우 (문자열 중간에 끊김)
  if (inString) {
    json += '"';
  }

  // 마지막 불완전한 객체 제거 시도
  // 패턴: },{ 로 끝나지 않는 경우, 마지막 { 이후를 제거
  if (braceCount > 0 || bracketCount > 0) {
    // 마지막으로 완전한 객체가 끝난 위치 찾기
    // "}" 다음에 오는 마지막 ","를 찾아서 그 뒤를 자름
    const lastCompleteObject = json.lastIndexOf("},");
    const lastCompleteArray = json.lastIndexOf("],");
    const lastComplete = Math.max(lastCompleteObject, lastCompleteArray);

    if (lastComplete > 0) {
      json = json.substring(0, lastComplete + 1); // "}" 또는 "]" 까지만 포함
    }
  }

  // 누락된 닫는 괄호 추가
  braceCount = 0;
  bracketCount = 0;
  inString = false;
  escapeNext = false;

  for (const char of json) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") braceCount++;
    else if (char === "}") braceCount--;
    else if (char === "[") bracketCount++;
    else if (char === "]") bracketCount--;
  }

  // 닫는 괄호 추가
  let repaired = json;
  for (let i = 0; i < bracketCount; i++) repaired += "]";
  for (let i = 0; i < braceCount; i++) repaired += "}";

  // 복구된 JSON 검증
  try {
    JSON.parse(repaired);
    console.warn(
      `[parseResults] JSON이 잘려 있어 복구했습니다. 추가된 괄호: ${bracketCount}개 ], ${braceCount}개 }`
    );
    return repaired;
  } catch {
    return null;
  }
}

/**
 * 파싱된 객체에서 results 배열을 추출합니다.
 */
function extractResultsArray(parsed: unknown): unknown[] | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  // { results: [...] } 형태
  if ("results" in parsed && Array.isArray((parsed as { results: unknown }).results)) {
    return (parsed as { results: unknown[] }).results;
  }

  // 바로 배열인 경우
  if (Array.isArray(parsed)) {
    return parsed;
  }

  return null;
}

/**
 * 원시 항목을 ParsedContentItem으로 변환합니다.
 */
function convertToContentItem(
  raw: unknown,
  index: number
):
  | { success: true; item: ParsedContentItem }
  | { success: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return {
      success: false,
      error: `항목 ${index + 1}: 유효하지 않은 객체입니다`,
    };
  }

  const obj = raw as Record<string, unknown>;

  // ────────────────────────────────────────────────────────────────────
  // 필수 필드 검증: title
  // ────────────────────────────────────────────────────────────────────

  if (!obj.title || typeof obj.title !== "string" || obj.title.trim() === "") {
    return {
      success: false,
      error: `항목 ${index + 1}: title이 없거나 비어있습니다`,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 필수 필드 검증: totalRange
  // ────────────────────────────────────────────────────────────────────

  const totalRange = parseNumber(obj.totalRange);

  if (totalRange === null || totalRange <= 0) {
    return {
      success: false,
      error: `항목 ${index + 1}: totalRange가 없거나 유효하지 않습니다`,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 콘텐츠 타입 결정
  // ────────────────────────────────────────────────────────────────────

  const contentType = parseContentType(obj.contentType, obj.title as string);

  // ────────────────────────────────────────────────────────────────────
  // 챕터 정보 파싱
  // ────────────────────────────────────────────────────────────────────

  const chapters = parseChapters(obj.chapters, totalRange);

  // ────────────────────────────────────────────────────────────────────
  // ParsedContentItem 생성
  // ────────────────────────────────────────────────────────────────────

  const item: ParsedContentItem = {
    title: (obj.title as string).trim(),
    contentType,
    totalRange,
    chapters,
  };

  // 선택적 필드 추가
  if (obj.author && typeof obj.author === "string") {
    item.author = obj.author.trim();
  }

  if (obj.publisher && typeof obj.publisher === "string") {
    item.publisher = obj.publisher.trim();
  }

  if (obj.description && typeof obj.description === "string") {
    item.description = obj.description.trim();
  }

  return { success: true, item };
}

/**
 * 값을 숫자로 변환합니다.
 */
function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * 콘텐츠 타입을 결정합니다.
 *
 * 명시적으로 지정되어 있으면 사용하고,
 * 없으면 제목에서 추론합니다.
 */
function parseContentType(value: unknown, title: string): ContentType {
  // 명시적으로 지정된 경우
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "book") return "book";
    if (lower === "lecture") return "lecture";
  }

  // 제목에서 추론
  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes("강의") ||
    lowerTitle.includes("인강") ||
    lowerTitle.includes("강좌") ||
    lowerTitle.includes("lecture")
  ) {
    return "lecture";
  }

  // 기본값은 book
  return "book";
}

/**
 * 챕터 정보를 파싱합니다.
 *
 * chapters 배열이 없거나 비어있으면, 전체 범위를 하나의 챕터로 생성합니다.
 */
function parseChapters(
  rawChapters: unknown,
  totalRange: number
): ChapterInfo[] {
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
    // 챕터 정보가 없으면 기본 챕터 생성
    return [
      {
        title: "전체",
        startRange: 1,
        endRange: totalRange,
      },
    ];
  }

  const chapters: ChapterInfo[] = [];

  for (const rawChapter of rawChapters) {
    if (!rawChapter || typeof rawChapter !== "object") {
      continue;
    }

    const ch = rawChapter as Record<string, unknown>;

    // title 필수
    if (!ch.title || typeof ch.title !== "string") {
      continue;
    }

    // 범위 파싱
    const startRange = parseNumber(ch.startRange) ?? 1;
    const endRange = parseNumber(ch.endRange) ?? totalRange;

    chapters.push({
      title: ch.title.trim(),
      startRange,
      endRange,
    });
  }

  // 파싱된 챕터가 없으면 기본 챕터
  if (chapters.length === 0) {
    return [
      {
        title: "전체",
        startRange: 1,
        endRange: totalRange,
      },
    ];
  }

  return chapters;
}

// ============================================================================
// 유틸리티 함수들
// ============================================================================

// P3-2: 콘텐츠 검증 상수
const VALIDATION_LIMITS = {
  MIN_TITLE_LENGTH: 2,
  MAX_TITLE_LENGTH: 200,
  MIN_TOTAL_RANGE: 1,
  MAX_TOTAL_RANGE: 10000, // 교재 최대 10000페이지, 강의 최대 10000개
  MAX_CHAPTERS: 500,
  MAX_CHAPTER_RANGE: 5000,
} as const;

/**
 * P3-2: 콘텐츠 검증 결과
 */
export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * P3-2: 파싱된 콘텐츠를 상세 검증합니다.
 *
 * 검증 항목:
 * - 필수 필드 존재 여부
 * - 필드값 범위 유효성
 * - 목차 구조 유효성
 * - 비정상적 데이터 경고
 *
 * @param item - 파싱된 콘텐츠 아이템
 * @returns 검증 결과 (에러/경고 포함)
 */
export function validateContentItem(item: ParsedContentItem): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 필수 필드 검증
  if (!item.title || item.title.length < VALIDATION_LIMITS.MIN_TITLE_LENGTH) {
    errors.push(`제목이 너무 짧습니다 (최소 ${VALIDATION_LIMITS.MIN_TITLE_LENGTH}자)`);
  }
  if (item.title && item.title.length > VALIDATION_LIMITS.MAX_TITLE_LENGTH) {
    warnings.push(`제목이 매우 깁니다 (${item.title.length}자)`);
  }

  // 2. 범위 검증
  if (!item.totalRange || item.totalRange < VALIDATION_LIMITS.MIN_TOTAL_RANGE) {
    errors.push("총 범위가 설정되지 않았습니다");
  }
  if (item.totalRange > VALIDATION_LIMITS.MAX_TOTAL_RANGE) {
    warnings.push(`총 범위가 비정상적으로 큽니다 (${item.totalRange})`);
  }

  // 3. 목차 검증
  if (!item.chapters || item.chapters.length === 0) {
    errors.push("목차 정보가 없습니다");
  } else {
    if (item.chapters.length > VALIDATION_LIMITS.MAX_CHAPTERS) {
      warnings.push(`목차가 매우 많습니다 (${item.chapters.length}개)`);
    }

    for (let i = 0; i < item.chapters.length; i++) {
      const ch = item.chapters[i];

      if (!ch.title || ch.title.length === 0) {
        errors.push(`목차 ${i + 1}의 제목이 없습니다`);
      }

      if (ch.startRange <= 0) {
        errors.push(`목차 ${i + 1}의 시작 범위가 유효하지 않습니다`);
      }

      if (ch.endRange < ch.startRange) {
        errors.push(`목차 ${i + 1}의 범위가 역전되었습니다 (${ch.startRange} > ${ch.endRange})`);
      }

      if (ch.endRange - ch.startRange > VALIDATION_LIMITS.MAX_CHAPTER_RANGE) {
        warnings.push(`목차 ${i + 1}의 범위가 비정상적으로 큽니다 (${ch.endRange - ch.startRange})`);
      }
    }

    // 목차 순서 검증
    for (let i = 1; i < item.chapters.length; i++) {
      if (item.chapters[i].startRange < item.chapters[i - 1].endRange) {
        warnings.push(`목차 ${i}와 ${i + 1}의 범위가 겹칩니다`);
      }
    }
  }

  // 4. 콘텐츠 타입별 추가 검증
  if (item.contentType === "lecture" && item.totalRange > 1000) {
    warnings.push(`강의 수가 비정상적으로 많습니다 (${item.totalRange}개)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 파싱된 결과가 플랜 생성에 충분한지 검증합니다.
 *
 * 플랜 생성에는 최소한 다음 정보가 필요합니다:
 * - title: 콘텐츠 제목
 * - totalRange: 총 범위 (페이지 수 또는 강의 수)
 * - chapters: 목차 (1개 이상)
 *
 * @param item - 파싱된 콘텐츠 아이템
 * @returns 플랜 생성 가능 여부
 */
export function isValidForPlanCreation(item: ParsedContentItem): boolean {
  const result = validateContentItem(item);
  return result.isValid;
}

/**
 * 파싱 결과에서 유효한 항목만 필터링합니다.
 *
 * @param items - 파싱된 콘텐츠 목록
 * @returns 플랜 생성 가능한 항목만 포함된 목록
 */
export function filterValidItems(items: ParsedContentItem[]): ParsedContentItem[] {
  return items.filter(isValidForPlanCreation);
}

/**
 * P3-2: 파싱 결과를 상세 검증하고 결과를 반환합니다.
 *
 * @param items - 파싱된 콘텐츠 목록
 * @returns 각 항목의 검증 결과와 유효한 항목 목록
 */
export function validateAndFilterItems(items: ParsedContentItem[]): {
  validItems: ParsedContentItem[];
  invalidCount: number;
  allWarnings: Array<{ title: string; warnings: string[] }>;
} {
  const validItems: ParsedContentItem[] = [];
  const allWarnings: Array<{ title: string; warnings: string[] }> = [];
  let invalidCount = 0;

  for (const item of items) {
    const result = validateContentItem(item);

    if (result.isValid) {
      validItems.push(item);
      if (result.warnings.length > 0) {
        allWarnings.push({ title: item.title, warnings: result.warnings });
      }
    } else {
      invalidCount++;
    }
  }

  return { validItems, invalidCount, allWarnings };
}
