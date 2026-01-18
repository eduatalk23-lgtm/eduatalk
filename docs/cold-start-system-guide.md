# 콜드 스타트 콘텐츠 추천 시스템 가이드

> 작성일: 2026-01-18
> 버전: 1.0.0
> 상태: Production Ready

## 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [API 엔드포인트](#api-엔드포인트)
4. [프로그래밍 인터페이스](#프로그래밍-인터페이스)
5. [배치 처리](#배치-처리)
6. [Rate Limit 및 할당량 관리](#rate-limit-및-할당량-관리)
7. [캐시 시스템](#캐시-시스템)
8. [트러블슈팅](#트러블슈팅)
9. [테스트](#테스트)

---

## 개요

### 콜드 스타트란?

학생 데이터(학습 이력, 성적 등)가 없는 신규 사용자에게 교과/과목/난이도 기반으로 적절한 학습 콘텐츠를 추천하는 시스템입니다.

### 주요 기능

- **웹 검색 기반 추천**: Gemini API + Google Search를 활용한 실시간 콘텐츠 검색
- **DB 캐시 활용**: 이전 검색 결과를 DB에 저장하여 재활용
- **Rate Limit Fallback**: API 한도 초과 시 자동으로 DB 캐시 사용
- **배치 처리**: 주요 교과/과목 조합 사전 크롤링

### 파이프라인 흐름

```
입력 검증 → 쿼리 생성 → 웹 검색 → 결과 파싱 → 랭킹/필터링 → [DB 저장]
     ↓           ↓           ↓           ↓              ↓
  validation   query      search      parse          rank
```

---

## 아키텍처

### 디렉토리 구조

```
lib/domains/plan/llm/
├── actions/coldStart/
│   ├── index.ts              # 메인 export
│   ├── pipeline.ts           # 파이프라인 통합
│   ├── types.ts              # 타입 정의
│   ├── validateInput.ts      # 입력 검증
│   ├── buildQuery.ts         # 검색 쿼리 생성
│   ├── executeSearch.ts      # 웹 검색 실행
│   ├── parseResults.ts       # 결과 파싱
│   ├── rankResults.ts        # 랭킹/필터링
│   ├── persistence/          # DB 저장 모듈
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── mappers.ts
│   │   ├── duplicateCheck.ts
│   │   └── saveRecommendations.ts
│   └── batch/                # 배치 처리 모듈
│       ├── index.ts
│       ├── types.ts
│       ├── targets.ts
│       └── runner.ts
├── providers/
│   └── gemini.ts             # Gemini API 클라이언트 + 할당량 트래커
├── services/
│   └── webSearchContentService.ts  # DB 캐시 서비스
└── metrics/                  # 메트릭스 시스템
```

### 핵심 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| `runColdStartPipeline` | 메인 파이프라인 실행 함수 |
| `WebSearchContentService` | DB 캐시 조회/저장 서비스 |
| `GeminiQuotaTracker` | 일일 API 할당량 추적 |
| `runColdStartBatch` | 배치 처리 실행 함수 |

---

## API 엔드포인트

### 콘텐츠 추천 API

```
POST /api/plan/content-recommendation
```

**Request Body:**
```json
{
  "subjectCategory": "수학",
  "subject": "미적분",
  "difficulty": "개념",
  "contentType": "book"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "title": "개념원리 미적분",
        "contentType": "book",
        "totalRange": 450,
        "author": "이홍섭",
        "publisher": "개념원리",
        "reason": "미적분 개념 학습에 적합한 교재",
        "matchScore": 92,
        "rank": 1
      }
    ],
    "stats": {
      "totalFound": 5,
      "filtered": 2,
      "searchQuery": "고등학교 수학 미적분 개념 교재 추천",
      "usedFallback": false
    }
  }
}
```

### 캐시 상태 API (관리자)

```
GET /api/admin/cache-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webSearchContent": {
      "hits": 42,
      "misses": 10,
      "size": 15,
      "hitRate": 0.81
    },
    "generatedAt": "2026-01-18T12:00:00.000Z"
  }
}
```

```
POST /api/admin/cache-stats
```

**Request Body (선택):**
```json
{
  "tenantId": null,
  "subjectCategory": "수학"
}
```

### Gemini 할당량 API (관리자)

```
GET /api/admin/gemini-quota
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dailyQuota": 20,
    "used": 15,
    "remaining": 5,
    "usagePercent": 75,
    "isNearLimit": false,
    "isExceeded": false,
    "rateLimitHits": 2,
    "lastRateLimitTime": 1705569600000,
    "resetDate": "2026-01-18"
  }
}
```

---

## 프로그래밍 인터페이스

### 기본 사용법

```typescript
import { runColdStartPipeline } from "@/lib/domains/plan/llm/actions/coldStart";

// 기본 호출
const result = await runColdStartPipeline({
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book",
});

if (result.success) {
  console.log(`추천: ${result.recommendations.length}개`);
  result.recommendations.forEach((rec) => {
    console.log(`- ${rec.title} (점수: ${rec.matchScore})`);
  });
} else {
  console.error(`실패 (${result.failedAt}): ${result.error}`);
}
```

### DB 저장 옵션

```typescript
const result = await runColdStartPipeline(
  {
    subjectCategory: "수학",
    subject: "미적분",
  },
  {
    saveToDb: true,      // DB에 저장
    tenantId: null,      // 공유 카탈로그 (또는 특정 테넌트 ID)
  }
);

if (result.success && result.persistence) {
  console.log(`새로 저장: ${result.persistence.newlySaved}개`);
  console.log(`중복 스킵: ${result.persistence.duplicatesSkipped}개`);
}
```

### Mock 모드 (테스트용)

```typescript
const result = await runColdStartPipeline(
  { subjectCategory: "수학" },
  { useMock: true }  // API 호출 없이 Mock 데이터 반환
);
```

### Fallback 비활성화

```typescript
const result = await runColdStartPipeline(
  { subjectCategory: "수학" },
  { enableFallback: false }  // Rate limit 시 DB fallback 사용 안 함
);
```

---

## 배치 처리

### CLI 스크립트 사용법

```bash
# 드라이런 (대상 확인만)
npx tsx scripts/cold-start-batch.ts core --dry-run

# 핵심 교과 배치 실행 (22개)
npx tsx scripts/cold-start-batch.ts core

# 수학만 실행 (21개)
npx tsx scripts/cold-start-batch.ts math

# Mock 모드 테스트
npx tsx scripts/cold-start-batch.ts core --mock --limit=5

# DB 저장 없이 테스트
npx tsx scripts/cold-start-batch.ts english --no-save

# 전체 교과 실행 (~80개, 약 20분 소요)
npx tsx scripts/cold-start-batch.ts all
```

### 프리셋 목록

| 프리셋 | 대상 수 | 설명 |
|--------|---------|------|
| `core` | 22개 | 수능 필수 + 주요 선택 과목 |
| `math` | 21개 | 수학 전체 (난이도별) |
| `english` | 10개 | 영어 전체 |
| `science` | 17개 | 과학탐구 전체 |
| `all` | ~80개 | 전체 교과/과목 |

### 프로그래밍 방식

```typescript
import {
  runColdStartBatch,
  dryRunBatch,
} from "@/lib/domains/plan/llm/actions/coldStart/batch";

// 드라이런
const { targets, estimatedDurationMinutes } = dryRunBatch("core");
console.log(`${targets.length}개 대상, 예상 ${estimatedDurationMinutes}분`);

// 실제 실행
const result = await runColdStartBatch("core", {
  saveToDb: true,
  delayBetweenRequests: 5000,  // Rate limit 방지
  onProgress: (p) => {
    console.log(`[${p.currentIndex + 1}/${p.total}] ${p.percentComplete}%`);
  },
  onComplete: (r) => {
    console.log(`완료: ${r.stats.succeeded}/${r.stats.total} 성공`);
  },
});
```

---

## Rate Limit 및 할당량 관리

### Gemini Free Tier 제한

| 항목 | 제한 |
|------|------|
| 일일 요청 | 20회 |
| 분당 요청 | 15회 (RPM) |
| 분당 토큰 | 32,000 (TPM) |

### 자동 보호 메커니즘

1. **Rate Limiter**: 요청 간 최소 4초 간격 유지
2. **자동 재시도**: Rate limit 에러 시 최대 3회 재시도 (지수 백오프)
3. **DB Fallback**: Rate limit 시 자동으로 DB 캐시 사용
4. **할당량 추적**: 일일 사용량 추적 및 경고 (80% 도달 시)

### 할당량 확인 코드

```typescript
import { getGeminiQuotaStatus } from "@/lib/domains/plan/llm/providers/gemini";

const status = getGeminiQuotaStatus();

console.log(`사용: ${status.used}/${status.dailyQuota} (${status.usagePercent}%)`);

if (status.isNearLimit) {
  console.warn("할당량 80% 이상 사용됨");
}

if (status.isExceeded) {
  console.error("할당량 초과!");
}
```

---

## 캐시 시스템

### 인메모리 캐시

| 설정 | 값 |
|------|-----|
| TTL | 5분 |
| 최대 엔트리 | 100개 |
| LRU 정책 | 자동 만료 시 제거 |

### 캐시 관리 코드

```typescript
import { getWebSearchContentService } from "@/lib/domains/plan/llm/services";

const service = getWebSearchContentService();

// 캐시 상태 확인
const stats = service.getCacheStats();
console.log(`히트: ${stats.hits}, 미스: ${stats.misses}`);

// 캐시 전체 초기화
service.clearCache();

// 특정 범위만 무효화
service.invalidateCache("tenant-123", "수학");
```

### DB 캐시 조회

```typescript
const cachedContent = await service.findExistingWebContent(null, {
  subjectCategory: "수학",
  subject: "미적분",
  contentType: "book",
  includeSharedCatalog: true,
  limit: 10,
});

console.log(`캐시된 콘텐츠: ${cachedContent.length}개`);
```

---

## 트러블슈팅

### 429 Too Many Requests

**증상**: `API 호출 한도를 초과했습니다` 에러

**원인**: Gemini Free Tier 일일/분당 할당량 초과

**해결**:
1. 할당량 확인: `GET /api/admin/gemini-quota`
2. 다음 날까지 대기 (일일 할당량 리셋)
3. Fallback 활성화 확인: `enableFallback: true` (기본값)
4. 배치 처리 시 `delayBetweenRequests` 증가

### 검색 결과 없음

**증상**: `recommendations: []` 반환

**원인**:
- 검색 쿼리가 너무 구체적
- 해당 교과/과목에 대한 콘텐츠가 없음
- 웹 검색 API 문제

**해결**:
1. `difficulty`, `contentType` 생략하고 재시도
2. DB 캐시 확인: `findExistingWebContent()` 호출
3. 배치 처리로 사전 축적

### 파싱 실패

**증상**: `failedAt: "parse"` 에러

**원인**: Gemini 응답이 예상 JSON 형식이 아님

**해결**:
1. Mock 모드로 테스트: `useMock: true`
2. 로그 확인: `lib/domains/plan/llm/metrics/` 참조
3. `parseResults.ts`의 폴백 로직 확인

### 캐시 히트율 낮음

**증상**: 캐시 미스가 많음

**원인**:
- TTL 만료
- 다양한 옵션 조합으로 캐시 키 분산
- 캐시 크기 제한 (100개)

**해결**:
1. 배치 처리로 주요 조합 사전 축적
2. 캐시 TTL 증가 고려 (현재 5분)
3. `includeSharedCatalog: true`로 공유 캐시 활용

---

## 테스트

### 테스트 실행

```bash
# 콜드 스타트 전체 테스트 (269개)
pnpm test lib/domains/plan/llm/actions/coldStart/

# 배치 모듈 테스트 (45개)
pnpm test lib/domains/plan/llm/actions/coldStart/batch/

# persistence 모듈 테스트 (67개)
pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/persistence/

# 전체 LLM 도메인 테스트 (789개)
pnpm test lib/domains/plan/llm/
```

### 테스트 커버리지

| 모듈 | 테스트 수 |
|------|----------|
| 파이프라인 (pipeline) | 17개 |
| 입력 검증 (validateInput) | 28개 |
| 쿼리 생성 (buildQuery) | 15개 |
| 결과 파싱 (parseResults) | 24개 |
| 랭킹/필터링 (rankResults) | 21개 |
| DB 저장 (persistence) | 67개 |
| 배치 처리 (batch) | 45개 |
| 시나리오 테스트 | 75개 |

### 실제 API 테스트

```bash
# API 키가 필요 (GOOGLE_GENERATIVE_AI_API_KEY)
npx tsx scripts/test-cold-start-api.ts
```

---

## 관련 문서

- [콜드 스타트 DB 저장 구현](./2026-01-18-cold-start-db-persistence-implementation.md)
- [콜드 스타트 통합 설계](./2026-01-18-cold-start-integration-design.md)
- [AI 콘텐츠 추천 분석](./ai-content-recommendation-analysis.md)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-18 | 1.0.0 | 초기 문서 작성 |
