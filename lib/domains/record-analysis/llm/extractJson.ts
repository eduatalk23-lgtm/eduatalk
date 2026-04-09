import { logActionError } from "@/lib/logging/actionLogger";

/**
 * AI 응답에서 JSON 문자열을 안전하게 추출
 *
 * 처리 순서:
 * 1. ```json ... ``` 마크다운 펜스 제거 (닫히지 않은 펜스도 처리)
 * 2. 펜스 매칭 실패 시 첫 번째 { ~ 마지막 } 또는 [ ~ ] 범위 추출
 * 3. trailing comma, 주석 등 흔한 AI JSON 오류 정리
 * 4. JSON.parse 시도 → 실패 시 문자열 내 줄바꿈 이스케이프 → 잘린 JSON 복구
 */
export function extractJson<T = unknown>(raw: string): T {
  let str = raw.trim();

  // 1단계: 마크다운 코드 펜스 제거
  // 1-a: 닫힌 펜스 (```json ... ```)
  const fenceMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  } else {
    // 1-b: 닫히지 않은 펜스 (```json\n... 로 시작하지만 닫는 ``` 없음)
    const openFence = str.match(/^```(?:json)?\s*\n?([\s\S]*)$/);
    if (openFence) {
      str = openFence[1].trim();
    }
  }

  // 2단계: 여전히 JSON이 아니면 첫 {/[ ~ 마지막 }/] 범위 추출
  if (!str.startsWith("{") && !str.startsWith("[")) {
    const firstBrace = str.indexOf("{");
    const firstBracket = str.indexOf("[");
    let start = -1;
    let end = -1;

    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = str.lastIndexOf("}");
    } else if (firstBracket >= 0) {
      start = firstBracket;
      end = str.lastIndexOf("]");
    }

    if (start >= 0 && end > start) {
      str = str.slice(start, end + 1);
    }
  }

  // 3단계: 흔한 AI JSON 오류 정리
  // 3-a: 한줄 주석 제거 (// ...) — 문자열 내부는 보존
  str = stripJsonComments(str);
  // 3-b: trailing comma 제거 (,] 또는 ,})
  str = str.replace(/,\s*([}\]])/g, "$1");

  // 파싱 파이프라인: 단계별로 점점 강력한 복구 시도
  const attempts: Array<() => string> = [
    // 4-a: 원본 그대로
    () => str,
    // 4-b: 문자열 내부 줄바꿈/탭 이스케이프
    () => escapeNewlinesInStrings(str),
    // 4-c: 잘린 JSON 복구
    () => repairTruncatedJson(escapeNewlinesInStrings(str)),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt()) as T;
    } catch (e) {
      lastError = e;
    }
  }

  // 파싱 실패 시 에러 위치 주변 로깅 (운영 디버깅용)
  if (lastError instanceof SyntaxError) {
    const posMatch = lastError.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const lastStr = repairTruncatedJson(escapeNewlinesInStrings(str));
      const around = lastStr.substring(Math.max(0, pos - 80), pos + 80);
      logActionError(
        { domain: "record-analysis", action: "extractJson" },
        `파싱 실패 — pos=${pos}, len=${lastStr.length}: ...${around}...`,
      );
    }
  }

  throw lastError;
}

/**
 * JSON 문자열 외부의 // 한줄 주석을 제거
 * 기존 regex lookbehind 방식은 가변 폭 패턴 문제로 동작하지 않아
 * 문자별 파서로 교체
 */
function stripJsonComments(json: string): string {
  const lines = json.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let inString = false;
    let escaped = false;
    let stripped = line;

    for (let i = 0; i < line.length; i++) {
      if (escaped) { escaped = false; continue; }
      if (line[i] === "\\") { escaped = true; continue; }
      if (line[i] === '"') { inString = !inString; continue; }
      if (!inString && line[i] === "/" && line[i + 1] === "/") {
        stripped = line.substring(0, i).trimEnd();
        break;
      }
    }

    // 빈 주석 전용 줄은 제거
    if (stripped.trim().length > 0 || line.trim().length === 0) {
      result.push(stripped);
    }
  }

  return result.join("\n");
}

/**
 * JSON 문자열 값 내부의 이스케이프되지 않은 줄바꿈/탭을 이스케이프
 * AI가 "direction": "첫 번째 줄\n두 번째 줄" 대신
 * 실제 줄바꿈을 넣는 문제를 해결
 */
function escapeNewlinesInStrings(json: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }

    result += ch;
  }

  return result;
}

/**
 * 토큰 제한 등으로 잘린 JSON 복구
 * - 미완성 문자열을 닫고
 * - 누락된 }, ] 를 보충
 */
function repairTruncatedJson(json: string): string {
  let s = json;

  // 미완성 문자열 닫기: 마지막 "가 열린 채로 끝난 경우
  const quoteCount = (s.match(/(?<!\\)"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    s += '"';
  }

  // 마지막 불완전 key-value 쌍 제거
  // 패턴: ,"key":값없음 | ,"key"콜론없음 | ,"key":"불완전값"
  s = s.replace(/,\s*"[^"]*"\s*:?\s*("([^"\\]|\\.)*")?\s*$/, "");

  // { 바로 뒤의 불완전 첫 key도 제거 (예: {"key"} → {})
  s = s.replace(/(\{)\s*"[^"]*"\s*$/, "$1");

  // trailing comma 정리
  s = s.replace(/,\s*$/, "");

  // 중첩 순서를 추적하여 올바른 닫는 괄호 순서 보장
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // 스택 역순으로 닫는 괄호 추가 (올바른 중첩 순서)
  while (stack.length > 0) {
    s += stack.pop();
  }

  return s;
}
