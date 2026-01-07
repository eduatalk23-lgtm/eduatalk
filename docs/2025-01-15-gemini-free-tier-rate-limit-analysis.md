# Google Gemini 무료 플랜 Rate Limit 분석 및 대응 방안

**작성일**: 2025-01-15  
**작성자**: AI Assistant  
**목적**: 관리자 영역 AI 플랜 생성 시 Google Gemini 무료 플랜의 제한사항 점검 및 초과 가능성 분석

---

## 📋 목차

1. [Gemini 무료 플랜 제한사항](#gemini-무료-플랜-제한사항)
2. [현재 구현 상태 분석](#현재-구현-상태-분석)
3. [문제점 및 위험 요소](#문제점-및-위험-요소)
4. [대응 방안](#대응-방안)
5. [권장 사항](#권장-사항)

---

## 🔍 Gemini 무료 플랜 제한사항

### 1. 요청 수 제한

#### 개인 계정 (무료 플랜)

- **분당 요청 수**: 최대 **60회** (RPM: Requests Per Minute)
- **일일 요청 수**: 최대 **1,000회** (RPD: Requests Per Day)

**참고**: 이 제한은 Google Gemini CLI의 무료 사용 정책을 기준으로 하며, API 사용 시에도 유사한 제한이 적용될 수 있습니다.

### 2. 토큰 처리 제한

#### Gemini 1.5 Flash 모델

- **분당 요청 수**: 최대 **15회**
- **분당 토큰 처리**: 최대 **100만 토큰** (1,000,000 tokens/minute)

#### 토큰 윈도우

- **컨텍스트 윈도우**: **100만 토큰** (1,000,000 tokens)

### 3. 모델별 제한사항

| 모델             | 분당 요청 수   | 분당 토큰 처리 | 일일 요청 수 |
| ---------------- | -------------- | -------------- | ------------ |
| Gemini 1.5 Flash | 15회           | 100만 토큰     | 1,000회      |
| Gemini 1.5 Pro   | 제한 정보 없음 | 제한 정보 없음 | 1,000회      |
| Gemini 2.0 Flash | 제한 정보 없음 | 제한 정보 없음 | 1,000회      |

**참고**: Gemini 2.0 Flash 및 Gemini 1.5 Pro의 정확한 제한사항은 Google 공식 문서를 통해 확인이 필요합니다.

### 4. 비용 정보 (무료 플랜 초과 시)

무료 플랜을 초과하는 사용량이 발생할 경우:

- **Gemini 1.5 Flash**:
  - Input: $0.075 per 1M tokens
  - Output: $0.3 per 1M tokens
- **Gemini 1.5 Pro / Gemini 2.0 Flash**:
  - Input: $1.25 per 1M tokens
  - Output: $5.0 per 1M tokens

---

## 🔎 현재 구현 상태 분석

### 1. 배치 AI 플랜 생성 로직

**파일**: `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`

#### 현재 동시 처리 설정

```typescript
const CONCURRENCY_LIMIT = 3; // 동시 처리 수 제한

// 배치 처리 (동시에 최대 3명씩)
for (let i = 0; i < students.length; i += CONCURRENCY_LIMIT) {
  const batch = students.slice(i, i + CONCURRENCY_LIMIT);

  const batchResults = await Promise.all(
    batch.map((s) => generatePlanForStudent(...))
  );

  // 레이트 리밋 방지를 위한 짧은 대기 (배치 사이)
  if (i + CONCURRENCY_LIMIT < students.length) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

#### 현재 사용 모델

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

```typescript
const GEMINI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    modelId: "gemini-2.0-flash", // ⚠️ Gemini 2.0 Flash
    maxTokens: 4096,
  },
  standard: {
    modelId: "gemini-2.0-flash", // ⚠️ Gemini 2.0 Flash
    maxTokens: 8192,
  },
  advanced: {
    modelId: "gemini-1.5-pro-latest", // ⚠️ Gemini 1.5 Pro
    maxTokens: 16384,
  },
};
```

### 2. Rate Limit 처리 현황

#### ✅ Supabase Rate Limit 처리

- **파일**: `lib/auth/rateLimitHandler.ts`
- **기능**: 429 에러 감지, 지수 백오프 재시도, 요청 간격 제어

#### ❌ Gemini API Rate Limit 처리

- **현재 상태**: **구현되지 않음**
- **문제점**:
  - 429 에러 처리 없음
  - 재시도 로직 없음
  - 요청 간격 제어 없음

### 3. 토큰 사용량 추정

**파일**: `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`

```typescript
// 평균적인 토큰 사용량 추정
// fast 모델 기준: 입력 ~2000 토큰, 출력 ~1500 토큰
const avgInputTokens = 2000;
const avgOutputTokens = 1500;
```

**실제 사용량**:

- 입력: 약 2,000 토큰/요청
- 출력: 약 1,500 토큰/요청
- **총 토큰**: 약 3,500 토큰/요청

---

## ⚠️ 문제점 및 위험 요소

### 1. 분당 요청 수 초과 위험

#### 시나리오 분석

**현재 설정**:

- 동시 처리: 3명
- 배치 사이 대기: 500ms

**문제점**:

1. **동시 3명 처리 시**: 3개 요청이 거의 동시에 발생
2. **배치 사이 500ms 대기**: 다음 배치까지 500ms 대기
3. **1분 동안 처리 가능한 학생 수**: 약 60명 (60회/분 ÷ 1회/학생)

**위험 시나리오**:

- 10명의 학생을 배치 생성할 경우:
  - 첫 번째 배치: 3명 동시 요청 (약 0초)
  - 두 번째 배치: 3명 동시 요청 (약 0.5초)
  - 세 번째 배치: 3명 동시 요청 (약 1.0초)
  - 네 번째 배치: 1명 요청 (약 1.5초)
  - **총 4초 동안 10회 요청** → ✅ 안전

- **100명의 학생을 배치 생성할 경우**:
  - 약 17개 배치 필요 (100 ÷ 3 = 33.3... → 34개 배치)
  - 각 배치 사이 500ms 대기
  - **총 소요 시간**: 약 17초
  - **분당 요청 수**: 약 353회 (100회 ÷ 17초 × 60초) → ❌ **초과 위험**

### 2. 일일 요청 수 초과 위험

**현재 설정**:

- 일일 최대 요청: 1,000회

**위험 시나리오**:

- 하루에 100명 이상의 학생에게 플랜을 생성하면 일일 제한 초과 가능

### 3. 토큰 처리 제한 위험

**Gemini 1.5 Flash 기준**:

- 분당 최대 토큰: 100만 토큰
- 요청당 평균 토큰: 약 3,500 토큰
- **분당 처리 가능 요청 수**: 약 285회 (1,000,000 ÷ 3,500)

**분석**:

- 토큰 제한보다 요청 수 제한이 더 엄격함
- 요청 수 제한(60회/분)이 먼저 걸릴 가능성이 높음

### 4. Rate Limit 에러 처리 부재

**현재 문제점**:

- Gemini API 429 에러 발생 시 재시도 로직 없음
- 에러 발생 시 전체 배치 실패 가능
- 사용자에게 명확한 에러 메시지 제공 안 됨

---

## 🛠️ 대응 방안

### 1. Rate Limit 처리 구현 (우선순위: 높음)

#### A. Gemini Provider에 Rate Limit 처리 추가

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

```typescript
// Rate Limit 에러 감지
private isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    // Google API 429 에러 감지
    return error.message.includes('429') ||
           error.message.includes('quota') ||
           error.message.includes('rate limit');
  }
  return false;
}

// 재시도 로직 추가
async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 기존 createMessage 로직
      return await this.createMessageInternal(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (this.isRateLimitError(error) && attempt < maxRetries) {
        // 지수 백오프: 2초, 4초, 8초
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[Gemini] Rate limit 감지, ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Unknown error');
}
```

#### B. 요청 간격 제어 (Throttling)

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

```typescript
class GeminiRateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number = 1000; // 최소 1초 간격 (60회/분 보장)

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

// createMessage에서 사용
async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
  await this.rateLimiter.waitIfNeeded();
  // ... 기존 로직
}
```

### 2. 배치 처리 개선 (우선순위: 중간)

#### A. 동시 처리 수 조정

**현재**: 3명 동시 처리  
**권장**: 1명씩 순차 처리 (분당 60회 제한 고려)

```typescript
// 옵션 1: 순차 처리 (안전)
const CONCURRENCY_LIMIT = 1;

// 옵션 2: 동시 처리 수를 2로 감소
const CONCURRENCY_LIMIT = 2;
```

#### B. 요청 간격 보장

**현재**: 배치 사이 500ms 대기  
**권장**: 최소 1초 간격 (60회/분 보장)

```typescript
// 배치 사이 대기 시간 증가
if (i + CONCURRENCY_LIMIT < students.length) {
  // 최소 1초 간격 보장 (60회/분 = 1회/초)
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
```

#### C. 일일 요청 수 추적

```typescript
// 일일 요청 수 추적 (Redis 또는 DB)
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

### 3. 모니터링 및 알림 (우선순위: 낮음)

#### A. Rate Limit 모니터링

```typescript
// Rate Limit 에러 발생 시 로깅
if (this.isRateLimitError(error)) {
  logActionDebug(
    { domain: "llm", action: "createMessage", provider: "gemini" },
    "Rate limit 에러 발생",
    {
      attempt,
      maxRetries,
      delay,
    }
  );
}
```

#### B. 사용량 대시보드

- 일일 요청 수 표시
- 분당 요청 수 표시
- 남은 할당량 표시

---

## 📊 권장 사항

### 즉시 적용 (우선순위: 높음)

1. **✅ Rate Limit 에러 처리 구현**
   - 429 에러 감지 및 재시도 로직
   - 지수 백오프 적용

2. **✅ 요청 간격 제어**
   - 최소 1초 간격 보장 (60회/분)
   - 배치 사이 대기 시간 증가 (500ms → 1000ms)

3. **✅ 동시 처리 수 조정**
   - 3명 → 1명 또는 2명으로 감소
   - 또는 요청 간격 제어로 3명 유지 가능

### 단기 개선 (1-2주)

4. **일일 요청 수 추적**
   - Redis 또는 DB에 일일 요청 수 저장
   - 할당량 초과 시 사전 차단

5. **에러 메시지 개선**
   - Rate limit 에러 시 사용자에게 명확한 메시지 제공
   - 재시도 가능 시간 안내

### 중기 개선 (1-2개월)

6. **모니터링 대시보드**
   - 실시간 요청 수 모니터링
   - 할당량 사용률 표시

7. **자동 스케일링**
   - 요청 수에 따라 동시 처리 수 자동 조정
   - 피크 시간대 대응

---

## 📈 예상 개선 효과

### 현재 상태

- ❌ Rate limit 에러 발생 시 전체 실패
- ❌ 대량 배치 생성 시 제한 초과 위험
- ❌ 에러 처리 부재

### 개선 후

- ✅ Rate limit 에러 자동 재시도
- ✅ 요청 간격 제어로 제한 준수
- ✅ 명확한 에러 메시지 제공
- ✅ 일일 할당량 추적 및 관리

---

## 🔗 관련 파일

### 핵심 구현 파일

- `lib/domains/plan/llm/providers/gemini.ts` - Gemini Provider (Rate Limit 처리 추가 필요)
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts` - 배치 생성 로직 (요청 간격 조정 필요)

### 참고 파일

- `lib/auth/rateLimitHandler.ts` - Supabase Rate Limit 처리 (참고용)
- `lib/domains/plan/llm/client.ts` - LLM 클라이언트

### 관련 문서

- `docs/2026-01-06_llm-provider-change-to-gemini.md` - LLM Provider 변경 문서
- `docs/2026-01-15-gemini-grounding-content-recommendation-implementation-status.md` - Grounding 기능 문서

---

## 📝 참고 자료

### Google Gemini API 공식 문서

- [Gemini API Rate Limits](https://ai.google.dev/pricing) (확인 필요)
- [Gemini API Quotas](https://ai.google.dev/docs/quota) (확인 필요)

### 웹 검색 결과 요약

- **개인 계정 무료 플랜**: 분당 60회, 일일 1,000회
- **Gemini 1.5 Flash**: 분당 15회, 분당 100만 토큰
- **토큰 윈도우**: 100만 토큰

**주의**: 정확한 제한사항은 Google 공식 문서를 통해 확인이 필요합니다.

---

## ✅ 체크리스트

### 즉시 적용 필요

- [ ] Gemini Provider에 Rate Limit 에러 처리 추가
- [ ] 요청 간격 제어 구현 (최소 1초)
- [ ] 배치 사이 대기 시간 증가 (500ms → 1000ms)
- [ ] 동시 처리 수 조정 검토 (3 → 1 또는 2)

### 단기 개선

- [ ] 일일 요청 수 추적 구현
- [ ] Rate limit 에러 메시지 개선
- [ ] 모니터링 로깅 추가

### 중기 개선

- [ ] 모니터링 대시보드 구현
- [ ] 자동 스케일링 로직 구현

---

**문서 작성 완료일**: 2025-01-15


