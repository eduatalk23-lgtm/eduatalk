# LLM 플랜 생성 모듈

Claude API를 사용한 자동 학습 플랜 생성 시스템입니다.

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 요청                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  actions/generatePlan.ts                                        │
│  - 인증 확인, 데이터 로드, 오케스트레이션                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  transformers/requestBuilder.ts                                  │
│  - DB 데이터 → LLM 요청 형식 변환                                 │
│  - 요청 유효성 검사                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  prompts/planGeneration.ts                                       │
│  - SYSTEM_PROMPT: 역할, 규칙, 출력 형식 정의                       │
│  - buildUserPrompt(): 학생 정보, 성적, 콘텐츠 구성                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  client.ts                                                       │
│  - Anthropic API 호출 (스트리밍/비스트리밍)                        │
│  - 토큰 추정, 비용 계산                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  transformers/responseParser.ts                                  │
│  - JSON 추출 및 파싱                                              │
│  - contentId 유효성 검증                                          │
│  - 품질 메트릭 검증                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DB 저장                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 파일 구조

```
lib/domains/plan/llm/
├── index.ts                    # 공개 API (export 관리)
├── types.ts                    # 타입 정의
├── client.ts                   # Anthropic API 클라이언트
├── prompts/
│   ├── planGeneration.ts       # 플랜 생성 프롬프트
│   └── partialRegeneration.ts  # 부분 재생성 프롬프트
├── transformers/
│   ├── requestBuilder.ts       # 요청 변환
│   └── responseParser.ts       # 응답 파싱 및 검증
└── actions/
    ├── generatePlan.ts         # 전체 생성 액션
    ├── streamPlan.ts           # 스트리밍 생성
    └── regeneratePartial.ts    # 부분 재생성
```

## 주요 타입

### 입력

```typescript
interface LLMPlanGenerationRequest {
  student: StudentInfo;           // 학생 기본 정보
  scores?: SubjectScore[];        // 과목별 성적 (isWeak 포함)
  contents: ContentInfo[];        // 학습 콘텐츠 목록
  learningHistory?: LearningHistory;  // 학습 이력
  settings: PlanGenerationSettings;   // 생성 설정
  timeSlots?: TimeSlotInfo[];     // 시간 슬롯
  additionalInstructions?: string;    // 추가 지시사항
}
```

### 설정 옵션

```typescript
interface PlanGenerationSettings {
  startDate: string;              // 시작 날짜 (YYYY-MM-DD)
  endDate: string;                // 종료 날짜
  dailyStudyMinutes: number;      // 하루 학습 시간 (분)
  excludeDays?: number[];         // 제외 요일 (0=일, 6=토)
  excludeDates?: string[];        // 제외 날짜
  prioritizeWeakSubjects?: boolean;   // 취약 과목 우선 배치
  balanceSubjects?: boolean;      // 과목 균형 맞추기
  includeReview?: boolean;        // 복습 포함
  reviewRatio?: number;           // 복습 비율 (0-1)
}
```

### 출력

```typescript
interface LLMPlanGenerationResponse {
  success: boolean;
  meta: GenerationMetadata;       // 모델, 신뢰도, 토큰 사용량
  weeklyMatrices: WeeklyPlanMatrix[];  // 주간 플랜
  totalPlans: number;
  recommendations: Recommendations;    // 학습 팁, 경고
}
```

## 모델 설정

| 티어 | 모델 | 최대 토큰 | Temperature | 용도 |
|------|------|----------|-------------|------|
| fast | claude-3-5-haiku | 4,096 | 0.3 | 빠른 미리보기 |
| standard | claude-sonnet-4 | 8,192 | 0.5 | 일반 생성 |
| advanced | claude-sonnet-4 | 16,384 | 0.7 | 복잡한 플랜 |

## 프롬프트 수정 가이드

### 시스템 프롬프트 (`SYSTEM_PROMPT`)

위치: `prompts/planGeneration.ts:21-138`

시스템 프롬프트는 다음 섹션으로 구성됩니다:

1. **역할 정의**: LLM의 역할과 목적
2. **핵심 원칙**: 개인화, 실현 가능성, 균형, 복습, 유연성
3. **출력 형식**: JSON 스키마 및 예시
4. **시간 슬롯 활용 규칙**: timeSlots 사용 방법
5. **취약 과목 배치 전략**: prioritizeWeakSubjects 적용 방법
6. **복습 비율 적용**: includeReview 및 reviewRatio 적용 방법
7. **콘텐츠 진도 분배**: 페이지/강의 분배 방법
8. **제외 규칙**: excludeDays, excludeDates 처리
9. **주의사항**: 형식, 필수 규칙

### 사용자 프롬프트 수정

새로운 섹션을 추가하려면 `buildUserPrompt` 함수에서:

```typescript
// 새 포맷 함수 추가
function formatNewSection(data: NewData): string {
  return `
## 새 섹션 제목
- 항목1: ${data.field1}
- 항목2: ${data.field2}
`.trim();
}

// buildUserPrompt에 추가
export function buildUserPrompt(request: LLMPlanGenerationRequest): string {
  const sections = [
    formatStudentInfo(request.student),
    // ... 기존 섹션
    formatNewSection(request.newData),  // 추가
  ].filter(Boolean);
  // ...
}
```

## 응답 검증

### contentId 유효성 검증

`parseLLMResponse` 함수에 `validContentIds` 파라미터를 전달하면 LLM이 반환한 contentId가 유효한지 검증합니다:

```typescript
const result = parseLLMResponse(
  content,
  modelId,
  usage,
  contentIds  // 유효한 콘텐츠 ID 목록
);

if (result.skippedPlans?.length) {
  console.warn('스킵된 플랜:', result.skippedPlans);
}
```

### 품질 메트릭 검증

생성 후 품질을 검증합니다:

```typescript
import { validateQualityMetrics } from './transformers/responseParser';

const qualityResult = validateQualityMetrics(
  response,
  settings,
  scores
);

if (!qualityResult.isValid) {
  console.warn('품질 경고:', qualityResult.warnings);
}

// 메트릭 확인
console.log('취약 과목 오전 배치 비율:', qualityResult.metrics.weakSubjectRatio);
console.log('실제 복습 비율:', qualityResult.metrics.reviewRatio);
console.log('과목별 학습 시간:', qualityResult.metrics.subjectDistribution);
```

## 테스트

### 단위 테스트 실행

```bash
pnpm test lib/domains/plan/llm
```

### 수동 테스트 시나리오

1. **기본 생성**: 1주일, 콘텐츠 3개, 기본 설정
2. **취약 과목 우선**: `prioritizeWeakSubjects: true`
3. **복습 포함**: `includeReview: true, reviewRatio: 0.2`
4. **과목 균형**: `balanceSubjects: true`
5. **시간 슬롯 사용**: `timeSlots` 배열 제공
6. **제외 요일**: `excludeDays: [0, 6]` (주말 제외)
7. **장기 플랜**: 30일, 콘텐츠 10개

## 비용 추정

```typescript
import { estimateCost } from './client';

const cost = estimateCost(inputTokens, outputTokens, 'standard');
console.log(`예상 비용: $${cost.toFixed(4)}`);
```

| 모델 | 입력 (1M 토큰) | 출력 (1M 토큰) |
|------|---------------|----------------|
| Haiku (fast) | $0.25 | $1.25 |
| Sonnet (standard/advanced) | $3.00 | $15.00 |

## 주의사항

1. **API 키**: `ANTHROPIC_API_KEY` 환경 변수 필요
2. **토큰 제한**: 콘텐츠 최대 20개, 성적 최근 20개로 제한
3. **기간 제한**: 최대 90일
4. **캐시 무효화**: 생성 후 `/plan`, `/plan/calendar`, `/today` 경로 무효화
