# ADR-001: LLM 통합을 통한 자동 플랜 생성

## 상태

**제안됨** (Proposed)

## 맥락

TimeLevelUp 서비스에서 학생의 학습 플랜 생성을 자동화하고자 합니다. 현재는 관리자가 수동으로 플랜을 생성하거나 학생이 위저드를 통해 직접 생성해야 하며, 이 과정이 복잡하고 시간이 많이 소요됩니다.

### 현재 상황

- 플랜 생성에 평균 5분 이상 소요
- 학생별 맞춤형 플랜 생성이 어려움
- 성적, 학습 이력, 선호도를 수동으로 고려해야 함
- 스케줄 최적화가 수작업으로 이루어짐

### 요구사항

1. 학생 정보를 기반으로 자동 플랜 생성
2. 성적 및 학습 이력 분석 반영
3. 생성된 플랜의 편집 가능성
4. 부분 재생성 지원 (특정 날짜/과목만)
5. 한글 교육 도메인 최적화

## 고려한 옵션

### 옵션 1: OpenAI GPT-4

**장점:**
- 풍부한 생태계 및 문서
- 다양한 모델 선택지 (GPT-4o, GPT-4 Turbo)
- Function Calling 지원

**단점:**
- 한글 성능이 Claude 대비 다소 낮음
- 비용이 상대적으로 높음
- 200K 토큰 컨텍스트 미지원

### 옵션 2: Claude API (Anthropic)

**장점:**
- 한글 성능 우수
- 200K 토큰 컨텍스트 지원
- JSON 구조화 출력 우수
- Tool Use (Function Calling) 지원
- 합리적인 가격 (claude-3-5-sonnet)

**단점:**
- OpenAI 대비 작은 생태계
- 일부 지역에서 접근 제한

### 옵션 3: 오픈소스 LLM (Llama, Mistral)

**장점:**
- 자체 호스팅으로 비용 절감 가능
- 데이터 프라이버시 보장
- 커스터마이징 가능

**단점:**
- 인프라 관리 부담
- 한글 성능 불확실
- 초기 셋업 비용 높음

### 옵션 4: 규칙 기반 자동화 (LLM 미사용)

**장점:**
- 예측 가능한 결과
- 비용 없음
- 빠른 처리 속도

**단점:**
- 유연성 부족
- 복잡한 로직 개발 필요
- 맞춤형 플랜 생성 한계

## 결정

**옵션 2: Claude API를 선택합니다.**

### 이유

1. **한글 교육 도메인 최적화**: 한국어로 된 과목명, 콘텐츠, 메모 등을 자연스럽게 처리
2. **긴 컨텍스트 지원**: 학생의 전체 학습 이력(성적, 진도, 선호도)을 한 번에 제공 가능
3. **JSON 구조화 출력**: 위저드가 바로 사용할 수 있는 형태로 플랜 생성
4. **비용 효율**: claude-3-5-sonnet($3/1M input, $15/1M output)으로 합리적 운영 가능
5. **Tool Use 지원**: 필요시 외부 API 호출 가능 (시간표 조회, 콘텐츠 검색 등)

## 구현 계획

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Plan Wizard (Frontend)                    │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 기본정보  │ -> │ AI 생성  │ -> │ 최종검토  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              lib/domains/plan/llm/                           │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   client    │  │   prompts   │  │ transformers │         │
│  │             │  │             │  │              │         │
│  │ Anthropic   │  │ 플랜생성    │  │ 입력빌더    │         │
│  │ SDK        │  │ 부분재생성   │  │ 출력파서    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude API                                │
│                                                              │
│  Model: claude-3-5-sonnet-20241022                          │
│  Context: 200K tokens                                        │
│  Output: JSON (Notion 스타일 주간 매트릭스)                  │
└─────────────────────────────────────────────────────────────┘
```

### 디렉토리 구조

```
lib/domains/plan/llm/
├── client.ts              # Anthropic SDK 초기화
├── types.ts               # 요청/응답 타입 정의
├── prompts/
│   ├── planGeneration.ts  # 플랜 생성 시스템 프롬프트
│   ├── partialRegeneration.ts # 부분 재생성 프롬프트
│   └── templates/
│       ├── studentContext.ts
│       └── outputFormat.ts
├── transformers/
│   ├── requestBuilder.ts  # DB 데이터 -> LLM 입력 변환
│   └── responseParser.ts  # LLM 출력 -> 플랜 데이터 변환
└── actions/
    ├── generatePlan.ts    # 전체 플랜 생성 서버 액션
    └── regeneratePartial.ts # 부분 재생성 서버 액션
```

### 핵심 타입

```typescript
// lib/domains/plan/llm/types.ts

export interface LLMPlanGenerationInput {
  student: {
    id: string;
    name: string;
    grade: number;
    preferences?: StudentPreferences;
  };
  scores: {
    subjectId: string;
    subjectName: string;
    averageScore: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  }[];
  learningHistory: {
    completedContents: number;
    averageCompletionRate: number;
    preferredTimeSlots: string[];
  };
  availableContents: {
    id: string;
    name: string;
    subjectId: string;
    difficulty: number;
    estimatedDuration: number;
  }[];
  planSettings: {
    startDate: string;
    endDate: string;
    dailyStudyHours: number;
    excludedDays: number[];
    focusSubjects?: string[];
  };
}

export interface LLMPlanGenerationResponse {
  meta: {
    confidence: number;      // 0-1
    reasoning: string;       // 생성 근거 설명
    warnings?: string[];     // 주의사항
  };
  weeklyMatrix: WeeklyPlanMatrix;
  recommendations: {
    studyTips: string[];
    focusAreas: string[];
    warnings: string[];
  };
}

export interface WeeklyPlanMatrix {
  days: DayPlan[];
}

export interface DayPlan {
  date: string;
  slots: SlotPlan[];
}

export interface SlotPlan {
  slotId: string;
  contentId?: string;
  customTitle?: string;
  estimatedDuration: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}
```

### 프롬프트 설계

```typescript
// lib/domains/plan/llm/prompts/planGeneration.ts

export const PLAN_GENERATION_SYSTEM_PROMPT = `
당신은 한국의 교육 전문가입니다. 학생의 학습 데이터를 분석하여 효과적인 주간 학습 플랜을 생성합니다.

## 역할
- 학생의 성적, 학습 이력, 선호도를 분석
- 약점 과목에 더 많은 시간 배분
- 집중력을 고려한 과목 배치 (어려운 과목은 오전에)
- 적절한 휴식 시간 확보

## 출력 규칙
1. JSON 형식으로만 응답
2. 각 슬롯에 하나의 콘텐츠만 배치
3. 일일 학습 시간 제한 준수
4. 연속 학습 시간은 2시간 이내로 제한

## 과목 배치 원칙
- 수학, 과학 등 집중력 필요 과목: 오전 1-2교시
- 언어 과목(국어, 영어): 오전-오후
- 암기 과목: 저녁 자습 시간
- 같은 과목은 하루에 최대 2회까지
`;

export function buildPlanGenerationPrompt(input: LLMPlanGenerationInput): string {
  return `
## 학생 정보
- 이름: ${input.student.name}
- 학년: ${input.student.grade}학년

## 최근 성적
${input.scores.map(s => `- ${s.subjectName}: ${s.averageScore}점 (${s.recentTrend})`).join('\n')}

## 학습 이력
- 완료한 콘텐츠: ${input.learningHistory.completedContents}개
- 평균 완료율: ${input.learningHistory.averageCompletionRate}%
- 선호 시간대: ${input.learningHistory.preferredTimeSlots.join(', ')}

## 사용 가능한 콘텐츠
${input.availableContents.map(c => `- [${c.id}] ${c.name} (난이도: ${c.difficulty}, ${c.estimatedDuration}분)`).join('\n')}

## 플랜 설정
- 기간: ${input.planSettings.startDate} ~ ${input.planSettings.endDate}
- 일일 학습 시간: ${input.planSettings.dailyStudyHours}시간
- 제외 요일: ${input.planSettings.excludedDays.join(', ') || '없음'}
${input.planSettings.focusSubjects ? `- 집중 과목: ${input.planSettings.focusSubjects.join(', ')}` : ''}

위 정보를 바탕으로 최적의 주간 학습 플랜을 JSON 형식으로 생성해주세요.
`;
}
```

### 서버 액션

```typescript
// lib/domains/plan/llm/actions/generatePlan.ts
'use server';

import Anthropic from '@anthropic-ai/sdk';
import { LLMPlanGenerationInput, LLMPlanGenerationResponse } from '../types';
import { PLAN_GENERATION_SYSTEM_PROMPT, buildPlanGenerationPrompt } from '../prompts/planGeneration';
import { validateAndParseLLMResponse } from '../transformers/responseParser';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generatePlanWithLLM(
  input: LLMPlanGenerationInput
): Promise<LLMPlanGenerationResponse> {
  const userPrompt = buildPlanGenerationPrompt(input);

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: PLAN_GENERATION_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return validateAndParseLLMResponse(content.text);
}
```

### 비용 최적화 전략

```typescript
// lib/domains/plan/llm/config.ts

export const LLM_CONFIG = {
  // 모델 티어링: 용도에 따라 다른 모델 사용
  models: {
    simple: 'claude-3-5-haiku-20241022',  // 간단한 추천, 메모 요약
    standard: 'claude-3-5-sonnet-20241022', // 플랜 생성
  },

  // 토큰 최적화
  optimization: {
    maxInputTokens: 8000,        // 입력 제한
    maxContentsPerRequest: 20,   // 콘텐츠 수 제한
    compressLearningHistory: true, // 히스토리 압축
  },

  // 캐싱
  cache: {
    enabled: true,
    ttl: 3600, // 1시간
    keyPrefix: 'llm-plan:',
  },

  // 레이트 리밋
  rateLimit: {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 100,
  },
};
```

### 에러 처리

```typescript
// lib/domains/plan/llm/errors.ts

export class LLMGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LLMGenerationError';
  }
}

export enum LLMErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
}

export function handleLLMError(error: unknown): never {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) {
      throw new LLMGenerationError(
        '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        LLMErrorCode.RATE_LIMITED
      );
    }
    throw new LLMGenerationError(
      'AI 서비스 오류가 발생했습니다.',
      LLMErrorCode.API_ERROR,
      error
    );
  }
  throw error;
}
```

## 결과

### 예상 비용

| 시나리오 | 월간 요청 수 | 예상 비용 |
|---------|-------------|----------|
| 초기 (소규모) | 500 | $10-15 |
| 성장기 | 2,000 | $30-50 |
| 확장기 | 5,000 | $80-120 |

### 성공 지표

| 지표 | 목표 |
|------|------|
| 플랜 생성 시간 | < 10초 |
| 사용자 수정 비율 | < 30% |
| 생성 성공률 | > 95% |

## 관련 문서

- [PRD: Notion 스타일 플랜 관리](./PRD-notion-style-plan-management.md)
- [TDD: 플랜 도메인 기술 설계](./TDD-plan-domain-enhancement.md)
- [ADR-002: Python 마이크로서비스](./ADR-002-python-microservice.md)
