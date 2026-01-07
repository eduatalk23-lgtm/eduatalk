# Gemini Rate Limit 에러 감지 함수 구현 가이드

**작성일**: 2026-01-06  
**작성자**: AI Assistant  
**목적**: Gemini Provider에 Rate Limit 에러 감지 함수를 최소 단위로 구현

---

## 📋 목차

1. [작업 개요](#작업-개요)
2. [구현 목표](#구현-목표)
3. [상세 구현 가이드](#상세-구현-가이드)
4. [테스트 방법](#테스트-방법)
5. [다음 단계](#다음-단계)

---

## 🎯 작업 개요

### 작업 범위

**최소 단위 작업**: Rate Limit 에러 감지 함수 (`isRateLimitError`) 구현

- **파일**: `lib/domains/plan/llm/providers/gemini.ts`
- **작업 유형**: 단일 private 메서드 추가
- **의존성**: 없음 (독립적 구현)
- **예상 소요 시간**: 10-15분

### 작업 우선순위

- **우선순위**: ⭐⭐⭐⭐⭐ (최우선)
- **난이도**: ⭐ (매우 쉬움)
- **영향 범위**: 에러 처리 로직 개선의 기초

---

## 🎯 구현 목표

### 목표

1. **Rate Limit 에러 감지**: 429 에러 및 할당량 초과 에러를 정확히 감지
2. **에러 메시지 패턴 매칭**: 다양한 에러 메시지 형식 지원
3. **재사용 가능한 함수**: 다른 메서드에서도 사용 가능하도록 구현

### 성공 기준

- ✅ 429 에러를 정확히 감지
- ✅ "quota" 키워드가 포함된 에러 감지
- ✅ "rate limit" 키워드가 포함된 에러 감지
- ✅ "too many requests" 키워드가 포함된 에러 감지
- ✅ 일반 에러는 false 반환

---

## 📝 상세 구현 가이드

### 1. 현재 코드 상태 확인

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

현재 `GeminiProvider` 클래스에는 Rate Limit 에러 감지 로직이 없습니다.

```88:100:lib/domains/plan/llm/providers/gemini.ts
export class GeminiProvider extends BaseLLMProvider {
  readonly type = "gemini" as const;
  readonly name = "Google Gemini";

  private client: GoogleGenerativeAI | null = null;
  private modelCache: Map<string, GenerativeModel> = new Map();

  /**
   * API 키 가져오기
   */
  private getApiKey(): string {
    return this.validateApiKey(process.env.GOOGLE_API_KEY, "GOOGLE_API_KEY");
  }
```

### 2. 구현 위치

`getApiKey()` 메서드 바로 다음에 추가합니다.

### 3. 구현 코드

**추가할 코드**:

````typescript
/**
 * Rate Limit 에러 감지
 *
 * Google Gemini API에서 발생하는 429 Too Many Requests 에러 및
 * 할당량 초과 에러를 감지합니다.
 *
 * @param error - 감지할 에러 객체
 * @returns Rate Limit 에러인 경우 true, 그렇지 않으면 false
 *
 * @example
 * ```typescript
 * try {
 *   await chat.sendMessage(message);
 * } catch (error) {
 *   if (this.isRateLimitError(error)) {
 *     // Rate limit 에러 처리
 *     console.warn("Rate limit 에러 발생");
 *   }
 * }
 * ```
 */
private isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();

  // 429 에러 코드 감지
  if (errorMessage.includes('429')) {
    return true;
  }

  // 할당량 관련 키워드 감지
  if (errorMessage.includes('quota')) {
    return true;
  }

  // Rate limit 관련 키워드 감지
  if (errorMessage.includes('rate limit')) {
    return true;
  }

  // Too many requests 관련 키워드 감지
  if (errorMessage.includes('too many requests')) {
    return true;
  }

  // GoogleGenerativeAI 에러 메시지 패턴 감지
  if (errorMessage.includes('exceeded your current quota')) {
    return true;
  }

  return false;
}
````

### 4. 전체 코드 구조

구현 후 코드 구조:

```typescript
export class GeminiProvider extends BaseLLMProvider {
  readonly type = "gemini" as const;
  readonly name = "Google Gemini";

  private client: GoogleGenerativeAI | null = null;
  private modelCache: Map<string, GenerativeModel> = new Map();

  /**
   * API 키 가져오기
   */
  private getApiKey(): string {
    return this.validateApiKey(process.env.GOOGLE_API_KEY, "GOOGLE_API_KEY");
  }

  /**
   * Rate Limit 에러 감지
   *
   * Google Gemini API에서 발생하는 429 Too Many Requests 에러 및
   * 할당량 초과 에러를 감지합니다.
   *
   * @param error - 감지할 에러 객체
   * @returns Rate Limit 에러인 경우 true, 그렇지 않으면 false
   */
  private isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();

    // 429 에러 코드 감지
    if (errorMessage.includes("429")) {
      return true;
    }

    // 할당량 관련 키워드 감지
    if (errorMessage.includes("quota")) {
      return true;
    }

    // Rate limit 관련 키워드 감지
    if (errorMessage.includes("rate limit")) {
      return true;
    }

    // Too many requests 관련 키워드 감지
    if (errorMessage.includes("too many requests")) {
      return true;
    }

    // GoogleGenerativeAI 에러 메시지 패턴 감지
    if (errorMessage.includes("exceeded your current quota")) {
      return true;
    }

    return false;
  }

  // ... 나머지 메서드들
}
```

---

## 🧪 테스트 방법

### 1. 단위 테스트 작성 (선택사항)

**파일**: `__tests__/lib/domains/plan/llm/providers/gemini.test.ts` (신규 생성)

```typescript
import { GeminiProvider } from "@/lib/domains/plan/llm/providers/gemini";

describe("GeminiProvider.isRateLimitError", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
  });

  // private 메서드 테스트를 위한 리플렉션 사용
  const isRateLimitError = (error: unknown): boolean => {
    return (provider as any).isRateLimitError(error);
  };

  it("429 에러를 감지해야 함", () => {
    const error = new Error(
      "[429 Too Many Requests] You exceeded your current quota"
    );
    expect(isRateLimitError(error)).toBe(true);
  });

  it("quota 키워드가 포함된 에러를 감지해야 함", () => {
    const error = new Error("Quota exceeded for metric");
    expect(isRateLimitError(error)).toBe(true);
  });

  it("rate limit 키워드가 포함된 에러를 감지해야 함", () => {
    const error = new Error("Rate limit exceeded");
    expect(isRateLimitError(error)).toBe(true);
  });

  it("too many requests 키워드가 포함된 에러를 감지해야 함", () => {
    const error = new Error("Too many requests");
    expect(isRateLimitError(error)).toBe(true);
  });

  it("exceeded your current quota 패턴을 감지해야 함", () => {
    const error = new Error(
      "You exceeded your current quota, please check your plan"
    );
    expect(isRateLimitError(error)).toBe(true);
  });

  it("일반 에러는 false를 반환해야 함", () => {
    const error = new Error("Network error");
    expect(isRateLimitError(error)).toBe(false);
  });

  it("Error가 아닌 객체는 false를 반환해야 함", () => {
    expect(isRateLimitError("string")).toBe(false);
    expect(isRateLimitError(123)).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
```

### 2. 수동 테스트

실제 API 호출에서 에러가 발생했을 때 함수가 올바르게 작동하는지 확인:

```typescript
// createMessage 메서드에서 테스트
try {
  const result = await chat.sendMessage(lastMessage.parts);
  // ...
} catch (error) {
  if (this.isRateLimitError(error)) {
    console.log("[Gemini] Rate limit 에러 감지됨:", error.message);
    // 다음 단계: 재시도 로직 구현
  } else {
    console.error("[Gemini] 다른 에러:", error);
    throw error;
  }
}
```

---

## 📋 구현 체크리스트

### 구현 전

- [ ] 현재 코드 상태 확인
- [ ] 구현 위치 결정 (`getApiKey()` 메서드 다음)
- [ ] 에러 메시지 패턴 확인

### 구현 중

- [ ] `isRateLimitError` 메서드 추가
- [ ] 429 에러 코드 감지 로직 추가
- [ ] "quota" 키워드 감지 로직 추가
- [ ] "rate limit" 키워드 감지 로직 추가
- [ ] "too many requests" 키워드 감지 로직 추가
- [ ] "exceeded your current quota" 패턴 감지 로직 추가
- [ ] Error 타입 체크 추가
- [ ] JSDoc 주석 추가

### 구현 후

- [ ] 코드 포맷팅 확인
- [ ] TypeScript 컴파일 에러 확인
- [ ] ESLint 에러 확인
- [ ] 수동 테스트 수행 (선택사항)
- [ ] 단위 테스트 작성 (선택사항)

---

## 🚀 다음 단계

이 작업이 완료되면 다음 단계로 진행할 수 있습니다:

### 즉시 다음 작업 (우선순위: 높음)

1. **재시도 로직 구현**
   - `createMessage` 메서드에 재시도 로직 추가
   - `isRateLimitError` 함수 활용
   - 지수 백오프 적용

2. **RetryInfo 추출 함수 구현**
   - 에러 응답에서 재시도 시간 추출
   - `extractRetryDelay` 메서드 추가

### 단기 개선

3. **요청 간격 제어**
   - `GeminiRateLimiter` 클래스 구현
   - 최소 1초 간격 보장

4. **에러 메시지 개선**
   - 사용자 친화적인 에러 메시지 제공
   - `AppError` 활용

---

## 📝 참고 자료

### 관련 문서

- `docs/2026-01-06-gemini-429-quota-exceeded-error-analysis.md` - 에러 분석 문서
- `docs/2025-01-15-gemini-free-tier-rate-limit-analysis.md` - Rate Limit 분석 문서

### Google API 문서

- [Gemini API Error Handling](https://ai.google.dev/gemini-api/docs/errors)
- [Google RPC Error Details](https://cloud.google.com/apis/design/errors#error_details)

### 실제 에러 메시지 예시

```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent:
[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.

Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count,
limit: 0, model: gemini-2.0-flash
```

---

## ✅ 완료 기준

이 작업은 다음 조건을 모두 만족하면 완료된 것으로 간주합니다:

1. ✅ `isRateLimitError` 메서드가 `GeminiProvider` 클래스에 추가됨
2. ✅ 모든 Rate Limit 에러 패턴을 감지할 수 있음
3. ✅ TypeScript 컴파일 에러 없음
4. ✅ ESLint 에러 없음
5. ✅ JSDoc 주석이 포함됨

---

**문서 작성 완료일**: 2026-01-06
