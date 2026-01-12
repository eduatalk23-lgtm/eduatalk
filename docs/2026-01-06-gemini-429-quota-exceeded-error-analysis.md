# Google Gemini API 429 Quota Exceeded 에러 분석

**작성일**: 2026-01-06  
**작성자**: AI Assistant  
**목적**: Google Gemini API에서 발생한 429 Too Many Requests 에러 분석 및 대응 방안

---

## 📋 목차

1. [에러 개요](#에러-개요)
2. [에러 상세 분석](#에러-상세-분석)
3. [할당량 제한 상세](#할당량-제한-상세)
4. [원인 분석](#원인-분석)
5. [대응 방안](#대응-방안)
6. [구현 상태 점검](#구현-상태-점검)
7. [권장 사항](#권장-사항)

---

## 🚨 에러 개요

### 발생한 에러

```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent:
[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.

Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count,
limit: 0, model: gemini-2.0-flash

Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests,
limit: 0, model: gemini-2.0-flash

Please retry in 5.803131916s.
```

### 에러 핵심 정보

- **에러 코드**: `429 Too Many Requests`
- **에러 타입**: `Quota Exceeded` (할당량 초과)
- **사용 모델**: `gemini-2.0-flash`
- **재시도 권장 시간**: `5.803131916초` (약 5.8초)
- **초과된 할당량**:
  1. `generate_content_free_tier_input_token_count` (입력 토큰 수)
  2. `generate_content_free_tier_requests` (분당 요청 수)
  3. `generate_content_free_tier_requests` (일당 요청 수)

---

## 🔍 에러 상세 분석

### 1. 할당량 메트릭 분석

에러 메시지에서 확인된 할당량 메트릭:

#### A. 입력 토큰 수 제한

```
generativelanguage.googleapis.com/generate_content_free_tier_input_token_count
```

- **메트릭 ID**: `GenerateContentInputTokensPerModelPerMinute-FreeTier`
- **제한**: `limit: 0` (무료 티어에서 할당량 없음 또는 이미 초과)
- **범위**: 모델별, 분당

#### B. 요청 수 제한 (분당)

```
generativelanguage.googleapis.com/generate_content_free_tier_requests
```

- **메트릭 ID**: `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`
- **제한**: `limit: 0` (무료 티어에서 할당량 없음 또는 이미 초과)
- **범위**: 프로젝트별, 모델별, 분당

#### C. 요청 수 제한 (일당)

```
generativelanguage.googleapis.com/generate_content_free_tier_requests
```

- **메트릭 ID**: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`
- **제한**: `limit: 0` (무료 티어에서 할당량 없음 또는 이미 초과)
- **범위**: 프로젝트별, 모델별, 일당

### 2. 에러 응답 구조

에러 응답에는 다음 정보가 포함되어 있습니다:

```json
{
  "@type": "type.googleapis.com/google.rpc.Help",
  "links": [
    {
      "description": "Learn more about Gemini API quotas",
      "url": "https://ai.google.dev/gemini-api/docs/rate-limits"
    }
  ],
  "@type": "type.googleapis.com/google.rpc.QuotaFailure",
  "violations": [
    {
      "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count",
      "quotaId": "GenerateContentInputTokensPerModelPerMinute-FreeTier",
      "quotaDimensions": {
        "model": "gemini-2.0-flash",
        "location": "global"
      }
    },
    {
      "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
      "quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
      "quotaDimensions": {
        "model": "gemini-2.0-flash",
        "location": "global"
      }
    },
    {
      "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
      "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      "quotaDimensions": {
        "model": "gemini-2.0-flash",
        "location": "global"
      }
    }
  ],
  "@type": "type.googleapis.com/google.rpc.RetryInfo",
  "retryDelay": "5s"
}
```

### 3. 재시도 정보

- **권장 재시도 시간**: `5.803131916초` (약 5.8초)
- **에러 타입**: `RetryInfo` 포함
- **재시도 전략**: 지수 백오프 권장

---

## 📊 할당량 제한 상세

### Google Gemini 무료 티어 제한사항

#### Gemini 2.0 Flash 모델

| 제한 항목          | 제한 값        | 범위                     | 메트릭 ID                                              |
| ------------------ | -------------- | ------------------------ | ------------------------------------------------------ |
| **분당 입력 토큰** | 제한 정보 없음 | 모델별, 분당             | `GenerateContentInputTokensPerModelPerMinute-FreeTier` |
| **분당 요청 수**   | 제한 정보 없음 | 프로젝트별, 모델별, 분당 | `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` |
| **일당 요청 수**   | 제한 정보 없음 | 프로젝트별, 모델별, 일당 | `GenerateRequestsPerDayPerProjectPerModel-FreeTier`    |

**참고**: Gemini 2.0 Flash의 정확한 제한사항은 Google 공식 문서를 통해 확인이 필요합니다.

#### Gemini 1.5 Flash 모델 (참고)

| 제한 항목          | 제한 값    | 범위                     |
| ------------------ | ---------- | ------------------------ |
| **분당 요청 수**   | 15회       | 모델별, 분당             |
| **분당 토큰 처리** | 100만 토큰 | 모델별, 분당             |
| **일당 요청 수**   | 1,000회    | 프로젝트별, 모델별, 일당 |

### 무료 티어 제한 해석

에러 메시지에서 `limit: 0`으로 표시된 것은 다음 중 하나를 의미할 수 있습니다:

1. **할당량이 모두 소진됨**: 무료 티어의 일일/분당 할당량을 모두 사용
2. **무료 티어 비활성화**: 무료 티어가 비활성화되었거나 만료됨
3. **계정 상태 문제**: 계정이 무료 티어를 사용할 수 없는 상태

---

## 🔎 원인 분석

### 1. 현재 구현 상태

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

#### 현재 사용 모델

```typescript
const GEMINI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    modelId: "gemini-2.0-flash", // ⚠️ Gemini 2.0 Flash
    maxTokens: 4096,
    temperature: 0.3,
  },
  standard: {
    modelId: "gemini-2.0-flash", // ⚠️ Gemini 2.0 Flash
    maxTokens: 8192,
    temperature: 0.5,
  },
  advanced: {
    modelId: "gemini-1.5-pro-latest",
    maxTokens: 16384,
    temperature: 0.7,
  },
};
```

#### Rate Limit 처리 상태

**현재 상태**: ❌ **구현되지 않음**

```293:377:lib/domains/plan/llm/providers/gemini.ts
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);

    console.log("[Gemini] createMessage 시작:", {
      modelId: config.modelId,
      tier: options.modelTier,
      groundingEnabled: options.grounding?.enabled,
      groundingMode: options.grounding?.mode,
    });

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출 (generateContent에 전달)
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    // Grounding tools 빌드 (modelId 전달)
    const tools = this.buildGroundingTools(options.grounding, config.modelId);

    console.log("[Gemini] Chat 설정:", {
      historyLength: history.length,
      toolsCount: tools.length,
      tools: JSON.stringify(tools),
    });

    // Chat 세션 시작 (Grounding tools 포함)
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      },
      // Grounding tools가 있는 경우에만 추가
      ...(tools.length > 0 && { tools }),
    });

    const result = await chat.sendMessage(lastMessage.parts);
    const response = result.response;
    const content = response.text();

    // 응답 구조 진단 로깅
    if (options.grounding?.enabled) {
      const candidate = response.candidates?.[0];
      console.log("[Gemini] 응답 구조:", {
        hasCandidate: !!candidate,
        finishReason: candidate?.finishReason,
        hasGroundingMetadata: !!candidate?.groundingMetadata,
        groundingMetadataKeys: candidate?.groundingMetadata
          ? Object.keys(candidate.groundingMetadata)
          : [],
      });
    }

    // Grounding 메타데이터 추출
    const groundingMetadata = options.grounding?.enabled
      ? this.extractGroundingMetadata(response)
      : undefined;

    if (options.grounding?.enabled) {
      console.log("[Gemini] Grounding 결과:", {
        hasMetadata: !!groundingMetadata,
        searchQueries: groundingMetadata?.searchQueries?.length ?? 0,
        webResults: groundingMetadata?.webResults?.length ?? 0,
      });
    }

    // 토큰 사용량 추정 (Gemini API는 정확한 토큰 수를 제공하지 않을 수 있음)
    const inputTokens = this.estimateTokens(
      options.system + options.messages.map((m) => m.content).join("")
    );
    const outputTokens = this.estimateTokens(content);

    return {
      content,
      stopReason: response.candidates?.[0]?.finishReason || null,
      usage: {
        inputTokens,
        outputTokens,
      },
      modelId: config.modelId,
      provider: "gemini",
      groundingMetadata,
    };
  }
```

**문제점**:

- ❌ 429 에러 감지 로직 없음
- ❌ 재시도 로직 없음
- ❌ 에러 처리 부재
- ❌ 요청 간격 제어 없음

### 2. 가능한 원인

#### A. 무료 티어 할당량 초과

1. **일일 요청 수 초과**
   - 하루 동안 너무 많은 요청 발생
   - 배치 AI 플랜 생성 등 대량 요청

2. **분당 요청 수 초과**
   - 짧은 시간 내 다수의 요청 발생
   - 동시 처리로 인한 요청 폭증

3. **입력 토큰 수 초과**
   - 대량의 입력 토큰 사용
   - 긴 프롬프트 또는 대량의 컨텍스트

#### B. 계정 상태 문제

1. **무료 티어 비활성화**
   - 무료 티어가 만료되었거나 비활성화됨
   - 결제 정보 미등록

2. **API 키 문제**
   - 잘못된 API 키 사용
   - API 키 권한 부족

#### C. 구현 문제

1. **Rate Limit 처리 부재**
   - 429 에러 발생 시 재시도 없음
   - 요청 간격 제어 없음

2. **동시 처리 과다**
   - 배치 처리 시 동시 요청 수 과다
   - 요청 간격 미보장

---

## 🛠️ 대응 방안

### 1. 즉시 대응 (우선순위: 높음)

#### A. Rate Limit 에러 처리 구현

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

```typescript
/**
 * Rate Limit 에러 감지
 */
private isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('429') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    );
  }
  return false;
}

/**
 * RetryInfo에서 재시도 시간 추출
 */
private extractRetryDelay(error: any): number {
  try {
    // 에러 응답에서 retryDelay 추출 시도
    if (error?.retryDelay) {
      return parseFloat(error.retryDelay) * 1000; // 초를 밀리초로 변환
    }
    // 기본값: 5.8초 (에러 메시지에서 확인된 값)
    return 5800;
  } catch {
    return 5800;
  }
}

/**
 * 메시지 생성 (비스트리밍) - Rate Limit 처리 포함
 */
async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.createMessageInternal(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (this.isRateLimitError(error) && attempt < maxRetries) {
        // RetryInfo에서 재시도 시간 추출 또는 지수 백오프
        const retryDelay = this.extractRetryDelay(error) || Math.pow(2, attempt) * 1000;
        const delay = Math.max(retryDelay, 1000); // 최소 1초

        console.warn(`[Gemini] Rate limit 감지, ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`, {
          error: lastError.message,
          retryDelay,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Rate limit이 아니거나 재시도 횟수 초과
      throw lastError;
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * 내부 메시지 생성 로직 (기존 createMessage 로직)
 */
private async createMessageInternal(options: CreateMessageOptions): Promise<CreateMessageResult> {
  // 기존 createMessage 로직을 여기로 이동
  // ...
}
```

#### B. 요청 간격 제어 (Throttling)

```typescript
class GeminiRateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number = 1000; // 최소 1초 간격 (60회/분 보장)
  private requestQueue: Array<() => Promise<void>> = [];
  private processing: boolean = false;

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`[Gemini] Rate limiter: ${waitTime}ms 대기`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

// GeminiProvider에 추가
private rateLimiter = new GeminiRateLimiter();

async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
  // 요청 간격 제어
  await this.rateLimiter.waitIfNeeded();

  // 기존 로직...
}
```

### 2. 단기 개선 (우선순위: 중간)

#### A. 배치 처리 개선

**파일**: `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`

```typescript
// 동시 처리 수 조정
const CONCURRENCY_LIMIT = 1; // 3 → 1로 변경 (안전)

// 배치 사이 대기 시간 증가
if (i + CONCURRENCY_LIMIT < students.length) {
  // 최소 1초 간격 보장 (60회/분 = 1회/초)
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 500ms → 1000ms
}
```

#### B. 에러 메시지 개선

```typescript
if (this.isRateLimitError(error)) {
  throw new AppError(
    "Gemini API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.",
    ErrorCode.RATE_LIMIT_EXCEEDED,
    429,
    {
      retryAfter: retryDelay / 1000, // 초 단위
      provider: "gemini",
      model: config.modelId,
    }
  );
}
```

### 3. 중기 개선 (우선순위: 낮음)

#### A. 일일 요청 수 추적

```typescript
// Redis 또는 DB에 일일 요청 수 저장
async function checkDailyQuota(tenantId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const requestCount = await getDailyRequestCount(tenantId, today);

  if (requestCount >= 1000) {
    throw new AppError(
      "일일 요청 한도(1,000회)를 초과했습니다. 내일 다시 시도해주세요.",
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429
    );
  }

  return true;
}
```

#### B. 모니터링 및 알림

```typescript
// Rate Limit 에러 발생 시 로깅
if (this.isRateLimitError(error)) {
  logActionDebug(
    { domain: "llm", action: "createMessage", provider: "gemini" },
    "Rate limit 에러 발생",
    {
      attempt,
      maxRetries,
      retryDelay,
      model: config.modelId,
    }
  );
}
```

---

## ✅ 구현 상태 점검

### 현재 상태

| 항목                     | 상태      | 비고 |
| ------------------------ | --------- | ---- |
| **Rate Limit 에러 감지** | ❌ 미구현 | 필요 |
| **재시도 로직**          | ❌ 미구현 | 필요 |
| **요청 간격 제어**       | ❌ 미구현 | 필요 |
| **에러 메시지 개선**     | ❌ 미구현 | 필요 |
| **일일 요청 수 추적**    | ❌ 미구현 | 선택 |
| **모니터링 로깅**        | ❌ 미구현 | 선택 |

### 기존 문서와의 관계

- **관련 문서**: `docs/2025-01-15-gemini-free-tier-rate-limit-analysis.md`
  - 이 문서는 예상된 문제점과 대응 방안을 다룸
  - 현재 문서는 실제 발생한 에러를 분석

---

## 📋 권장 사항

### 즉시 적용 (우선순위: 높음)

1. **✅ Rate Limit 에러 처리 구현**
   - 429 에러 감지 및 재시도 로직
   - RetryInfo에서 재시도 시간 추출
   - 지수 백오프 적용

2. **✅ 요청 간격 제어**
   - 최소 1초 간격 보장 (60회/분)
   - RateLimiter 클래스 구현

3. **✅ 에러 메시지 개선**
   - 사용자에게 명확한 에러 메시지 제공
   - 재시도 가능 시간 안내

### 단기 개선 (1-2주)

4. **배치 처리 개선**
   - 동시 처리 수 조정 (3 → 1)
   - 배치 사이 대기 시간 증가 (500ms → 1000ms)

5. **로깅 강화**
   - Rate limit 에러 발생 시 상세 로깅
   - 요청 수 및 토큰 사용량 추적

### 중기 개선 (1-2개월)

6. **일일 요청 수 추적**
   - Redis 또는 DB에 일일 요청 수 저장
   - 할당량 초과 시 사전 차단

7. **모니터링 대시보드**
   - 실시간 요청 수 모니터링
   - 할당량 사용률 표시

---

## 🔗 관련 파일

### 핵심 구현 파일

- `lib/domains/plan/llm/providers/gemini.ts` - Gemini Provider (Rate Limit 처리 추가 필요)
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts` - 배치 생성 로직 (요청 간격 조정 필요)

### 참고 파일

- `lib/auth/rateLimitHandler.ts` - Supabase Rate Limit 처리 (참고용)
- `lib/domains/plan/llm/client.ts` - LLM 클라이언트

### 관련 문서

- `docs/2025-01-15-gemini-free-tier-rate-limit-analysis.md` - Rate Limit 분석 문서
- `docs/2026-01-06_llm-provider-change-to-gemini.md` - LLM Provider 변경 문서
- `docs/2026-01-15-gemini-grounding-content-recommendation-implementation-status.md` - Grounding 기능 문서

---

## 📝 참고 자료

### Google Gemini API 공식 문서

- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Quotas](https://ai.google.dev/docs/quota)
- [Gemini API Error Handling](https://ai.google.dev/gemini-api/docs/errors)

### 에러 응답 구조

- [Google RPC Error Details](https://cloud.google.com/apis/design/errors#error_details)
- [Quota Failure](https://cloud.google.com/apis/design/errors#quota_failures)
- [Retry Info](https://cloud.google.com/apis/design/errors#retry_info)

---

## ✅ 체크리스트

### 즉시 적용 필요

- [ ] Gemini Provider에 Rate Limit 에러 처리 추가
- [ ] RetryInfo에서 재시도 시간 추출 로직 구현
- [ ] 요청 간격 제어 구현 (최소 1초)
- [ ] 에러 메시지 개선 (사용자 친화적)

### 단기 개선

- [ ] 배치 처리 개선 (동시 처리 수 조정)
- [ ] 배치 사이 대기 시간 증가 (500ms → 1000ms)
- [ ] Rate limit 에러 로깅 강화
- [ ] 요청 수 및 토큰 사용량 추적

### 중기 개선

- [ ] 일일 요청 수 추적 구현
- [ ] 모니터링 대시보드 구현
- [ ] 자동 스케일링 로직 구현

---

**문서 작성 완료일**: 2026-01-06



