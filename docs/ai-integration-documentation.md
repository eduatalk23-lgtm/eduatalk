# AI 통합 기술 문서

> 작성일: 2026-01-14
> 프로젝트: TimeLevelUp

## 개요

이 프로젝트는 학습 플랜 생성, 콘텐츠 추천, 난이도 분석 등 교육 도메인의 다양한 AI 응용을 위해 **다중 AI 프로바이더**를 지원하는 LLM 통합 시스템을 구현하고 있습니다.

---

## 1. AI 라이브러리 및 의존성

### 사용 중인 패키지

| 라이브러리 | 버전 | 목적 |
|-----------|------|------|
| `@anthropic-ai/sdk` | ^0.71.2 | Anthropic Claude API |
| `openai` | ^6.15.0 | OpenAI GPT API |
| `@google/generative-ai` | ^0.24.1 | Google Gemini API |

---

## 2. 아키텍처

### 2.1 디렉토리 구조

```
lib/domains/plan/llm/
├── client.ts                 # 통합 LLM 클라이언트
├── types.ts                  # 공통 타입 정의
├── providers/                # AI 프로바이더 구현
│   ├── base.ts               # 기본 인터페이스
│   ├── anthropic.ts          # Anthropic Claude
│   ├── openai.ts             # OpenAI GPT
│   ├── gemini.ts             # Google Gemini
│   └── config.ts             # 프로바이더 설정
├── prompts/                  # AI 프롬프트
│   ├── planGeneration.ts
│   ├── contentRecommendation.ts
│   ├── enhancedContentRecommendation.ts
│   ├── difficultyAssessment.ts
│   ├── planOptimization.ts
│   ├── frameworkGeneration.ts
│   └── partialRegeneration.ts
├── actions/                  # 서버 액션
│   ├── generatePlan.ts
│   ├── streamPlan.ts
│   ├── recommendContent.ts
│   ├── enhancedRecommendContent.ts
│   ├── generateHybridPlanComplete.ts
│   ├── optimizePlan.ts
│   └── regeneratePartial.ts
├── services/                 # 서비스
│   ├── llmCacheService.ts
│   ├── providerSelectionService.ts
│   ├── tokenOptimizationService.ts
│   ├── contentDifficultyService.ts
│   ├── prerequisiteService.ts
│   ├── personalizedMatchingService.ts
│   └── webSearchContentService.ts
├── validators/               # 검증기
│   ├── planValidator.ts
│   └── enhancedPlanValidator.ts
├── transformers/             # 데이터 변환
│   ├── requestBuilder.ts
│   └── responseParser.ts
└── converters/               # 형식 변환
    └── frameworkToSchedulerOptions.ts
```

### 2.2 데이터 흐름

```
사용자 요청
    ↓
Server Action (actions/)
    ↓
프롬프트 빌드 (prompts/)
    ↓
LLM 클라이언트 (client.ts)
    ↓
프로바이더 선택 (providers/)
    ↓
AI API 호출
    ↓
응답 파싱 (transformers/)
    ↓
검증 (validators/)
    ↓
DB 저장
```

---

## 3. AI 프로바이더

### 3.1 Anthropic Claude

**파일**: `lib/domains/plan/llm/providers/anthropic.ts`

| 티어 | 모델 | 최대 토큰 | 입력 비용 | 출력 비용 |
|------|------|----------|----------|----------|
| Fast | claude-3-5-haiku-20241022 | 4,096 | $0.25/1M | $1.25/1M |
| Standard | claude-sonnet-4-20250514 | 8,192 | $3.0/1M | $15.0/1M |
| Advanced | claude-sonnet-4-20250514 | 16,384 | $3.0/1M | $15.0/1M |

**환경변수**: `ANTHROPIC_API_KEY`

### 3.2 OpenAI GPT

**파일**: `lib/domains/plan/llm/providers/openai.ts`

| 티어 | 모델 | 최대 토큰 | 입력 비용 | 출력 비용 |
|------|------|----------|----------|----------|
| Fast | gpt-4o-mini | 4,096 | $0.15/1M | $0.6/1M |
| Standard | gpt-4o | 8,192 | $2.5/1M | $10.0/1M |
| Advanced | gpt-4-turbo | 16,384 | $10.0/1M | $30.0/1M |

**환경변수**: `OPENAI_API_KEY`

### 3.3 Google Gemini

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

| 티어 | 모델 | 최대 토큰 | 입력 비용 | 출력 비용 |
|------|------|----------|----------|----------|
| Fast | gemini-2.0-flash | 4,096 | $0.075/1M | $0.3/1M |
| Standard | gemini-2.0-flash | 8,192 | $0.075/1M | $0.3/1M |
| Advanced | gemini-1.5-pro-latest | 16,384 | $1.25/1M | $5.0/1M |

**환경변수**: `GOOGLE_API_KEY`

**특수 기능 - Grounding (웹 검색)**:
```typescript
grounding: {
  enabled: true,
  mode: 'dynamic',        // 필요시에만 검색
  dynamicThreshold: 0.3   // 관련성 임계값
}
```

---

## 4. 주요 AI 기능

### 4.1 학습 플랜 생성

**서버 액션**: `generatePlanWithAI()` - `lib/domains/plan/llm/actions/generatePlan.ts`

**입력**:
```typescript
interface GeneratePlanInput {
  contentIds: string[];           // 학습할 콘텐츠
  startDate: string;              // YYYY-MM-DD
  endDate: string;
  dailyStudyMinutes: number;
  excludeDays?: number[];         // 0-6 (일-토)
  excludeDates?: string[];
  prioritizeWeakSubjects?: boolean;
  balanceSubjects?: boolean;
  includeReview?: boolean;
  reviewRatio?: number;           // 0-1
  modelTier?: 'fast' | 'standard' | 'advanced';
  enableWebSearch?: boolean;      // Gemini Grounding
}
```

**출력**: JSON 형식의 주간 학습 매트릭스

**관련 UI**: `AdminAIPlanModal.tsx`

### 4.2 하이브리드 플랜 생성

**서버 액션**: `generateHybridPlanCompleteAction()` - `lib/domains/plan/llm/actions/generateHybridPlanComplete.ts`

AI의 전략적 프레임워크와 코드 기반 스케줄러를 결합한 방식:

1. **AI Framework 생성**: 과목 분류, 우선순위, 시간 힌트
2. **Framework → SchedulerOptions 변환**
3. **코드 스케줄러로 정확한 시간 배치**
4. **AI 추천사항 첨부**

### 4.3 스트리밍 플랜 생성

**서버 액션**: `streamPlanGeneration()` - `lib/domains/plan/llm/actions/streamPlan.ts`

실시간으로 생성 진행 상황을 클라이언트에 전송:

```typescript
type StreamEvent = 'start' | 'progress' | 'text' | 'parsing' | 'complete' | 'error';
```

### 4.4 콘텐츠 추천

**서버 액션**: `recommendContentWithAI()` - `lib/domains/plan/llm/actions/recommendContent.ts`

**입력**:
```typescript
interface RecommendContentInput {
  studentId: string;
  subjectCategories?: string[];
  maxRecommendations?: number;    // 기본: 5
  focusArea?: 'weak_subjects' | 'all_subjects' | 'exam_prep';
  modelTier?: 'fast' | 'standard' | 'advanced';
}
```

**향상된 버전**: `enhancedRecommendContentWithAI()` - `lib/domains/plan/llm/actions/enhancedRecommendContent.ts`
- 시너지 콘텐츠 추천
- 난이도 진행 적용
- 매칭 점수 세분화

**관련 UI**: `AdminContentRecommendationPanel.tsx`

### 4.5 부분 재생성

**서버 액션**: `regeneratePartialPlan()` - `lib/domains/plan/llm/actions/regeneratePartial.ts`

특정 범위만 재생성:
- `regenerateDatePlans()`: 특정 날짜
- `regenerateSubjectPlans()`: 특정 과목
- `regenerateContentPlans()`: 특정 콘텐츠
- `regenerateDateRangePlans()`: 날짜 범위

### 4.6 플랜 최적화

**서버 액션**: `analyzePlanEfficiency()` - `lib/domains/plan/llm/actions/optimizePlan.ts`

기존 플랜의 실행 통계를 분석하여 개선 제안:
- 시간대별 성과
- 요일별 성과
- 과목별 성과
- 학습 패턴

---

## 5. 서비스

### 5.1 LLM 캐시 서비스

**파일**: `lib/domains/plan/llm/services/llmCacheService.ts`

동일한 요청 결과를 메모리에 캐싱:
- `plan_generation`
- `content_recommendation`
- `difficulty_analysis`

### 5.2 프로바이더 선택 서비스

**파일**: `lib/domains/plan/llm/services/providerSelectionService.ts`

요청 복잡도에 따라 최적의 프로바이더/티어 자동 선택

### 5.3 토큰 최적화 서비스

**파일**: `lib/domains/plan/llm/services/tokenOptimizationService.ts`

- 콘텐츠 정보 압축
- 학습 이력 요약
- 중복 정보 제거

### 5.4 콘텐츠 난이도 서비스

**파일**: `lib/domains/plan/llm/services/contentDifficultyService.ts`

콘텐츠 난이도 분석 및 캐싱

### 5.5 선수지식 서비스

**파일**: `lib/domains/plan/llm/services/prerequisiteService.ts`

- 개념 그래프 생성
- 학습 순서 제안
- 학습 갭 식별

### 5.6 맞춤형 매칭 서비스

**파일**: `lib/domains/plan/llm/services/personalizedMatchingService.ts`

콘텐츠-학생 적합도 분석

### 5.7 웹 검색 콘텐츠 서비스

**파일**: `lib/domains/plan/llm/services/webSearchContentService.ts`

Gemini Grounding 검색 결과 관리 및 DB 저장

---

## 6. 검증 시스템

### 6.1 기본 검증

**파일**: `lib/domains/plan/llm/validators/planValidator.ts`

- 시간 형식 (HH:MM)
- 일일 학습 시간 제약
- 블록 호환성
- 학원 일정 충돌
- 제외 날짜 준수

### 6.2 향상된 검증

**파일**: `lib/domains/plan/llm/validators/enhancedPlanValidator.ts`

추가 검증:
- 콘텐츠 범위 유효성
- 과목 균형
- 연속 과목 배치
- 학습 갭 감지
- 일일 부하

**품질 등급**: A, B, C, D, F

---

## 7. LLM 클라이언트 API

**파일**: `lib/domains/plan/llm/client.ts`

### 비스트리밍 메시지 생성

```typescript
const result = await createMessage({
  system: '시스템 프롬프트',
  messages: [
    { role: 'user', content: '사용자 메시지' }
  ],
  modelTier: 'standard',
  temperature: 0.7,
  grounding: {
    enabled: true,
    mode: 'dynamic'
  }
});

// result: { content, stopReason, usage, modelId, groundingMetadata? }
```

### 스트리밍 메시지 생성

```typescript
await streamMessage({
  system: '시스템 프롬프트',
  messages: [...],
  onText: (chunk) => console.log(chunk),
  onComplete: (result) => console.log('완료', result),
  onError: (error) => console.error(error)
});
```

### 유틸리티 함수

```typescript
// JSON 추출
const data = extractJSON<MyType>(llmResponse);

// 토큰 추정
const tokens = estimateTokens(text);

// 비용 추정
const cost = estimateCost(inputTokens, outputTokens, 'standard');
```

---

## 8. 환경변수 설정

```bash
# .env.local

# 기본 프로바이더 (anthropic | openai | gemini)
LLM_PROVIDER=anthropic

# 기본 모델 티어 (fast | standard | advanced)
LLM_DEFAULT_TIER=standard

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI API
OPENAI_API_KEY=sk-...

# Google Gemini API
GOOGLE_API_KEY=AIzaSy...
```

---

## 9. UI 컴포넌트

### 9.1 AI 플랜 생성 모달

**파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx`

- 생성 모드 선택 (하이브리드 vs AI-only)
- 웹 검색 옵션 토글
- 진행 상황 실시간 표시

### 9.2 콘텐츠 추천 패널

**파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminContentRecommendationPanel.tsx`

- 추천 포커스 선택
- 추천 개수 설정
- 추천 결과 표시 및 추가

---

## 10. 사용 예시

### 플랜 생성

```typescript
import { generatePlanWithAI } from '@/lib/domains/plan/llm';

const result = await generatePlanWithAI({
  contentIds: ['content-1', 'content-2'],
  startDate: '2026-01-15',
  endDate: '2026-02-15',
  dailyStudyMinutes: 180,
  excludeDays: [0, 6],  // 주말 제외
  prioritizeWeakSubjects: true,
  modelTier: 'standard'
});
```

### 콘텐츠 추천

```typescript
import { recommendContentWithAI } from '@/lib/domains/plan/llm';

const recommendations = await recommendContentWithAI({
  studentId: 'student-123',
  focusArea: 'weak_subjects',
  maxRecommendations: 5,
  modelTier: 'fast'
});
```

### 하이브리드 플랜 생성

```typescript
import { generateHybridPlanCompleteAction } from '@/lib/domains/plan/llm';

const result = await generateHybridPlanCompleteAction({
  studentId: 'student-123',
  contentIds: ['content-1', 'content-2'],
  startDate: '2026-01-15',
  endDate: '2026-02-15',
  dailyStudyMinutes: 180,
  modelTier: 'standard'
});
```

---

## 11. 비용 관리

### 토큰 추정 규칙

- 한글: 약 1.5 토큰/문자
- 영어: 약 0.25 토큰/문자

### 비용 최적화 전략

1. **캐싱**: 동일 요청 결과 메모리 캐싱
2. **티어 선택**: 간단한 요청은 Fast 티어 사용
3. **토큰 압축**: 불필요한 정보 제거
4. **프로바이더 선택**: 비용 대비 품질 고려

---

## 12. 보안 고려사항

- **API 키 서버 측 관리**: 클라이언트에 노출 금지
- **Rate Limiting**: Gemini Free Tier 4초 간격 제어
- **토큰 제한**: maxTokens 설정으로 비용 제어
- **에러 처리**: 모든 API 호출에 try-catch 적용

---

## 13. 향후 개선 계획

1. **멀티모달 지원**: 이미지 기반 문제 분석
2. **벡터 DB 통합**: 콘텐츠 시맨틱 검색
3. **실시간 피드백**: 학습 진행 중 AI 코칭
4. **A/B 테스트**: 프로바이더별 품질 비교
