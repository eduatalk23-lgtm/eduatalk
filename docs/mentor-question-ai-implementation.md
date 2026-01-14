# 멘토 질문: AI 기반 학습 플랜 생성 구현 방향

> 작성일: 2026-01-14

---

## 1. 프로젝트 배경 및 초기 의도

### 원래 목표

학습 플랜 작성에 필요한 요소만 학생 또는 컨설턴트(관리자)가 입력하면:

1. **콘텐츠 추천**: 맞춤 학습 교재/강의 추천
2. **일정 배분**: 해당 콘텐츠를 일정에 맞춰 자동 배분
3. **진행상황 조율**: 학습 진행상황에 따라 일정 자동 조율

→ AI 기능을 활용한 **학습 플랜 자동화** 구현

---

## 2. 현재 구현 상태

### 구현된 AI 기능 (코드 레벨)

| 기능 | 파일 | 상태 |
|------|------|------|
| 다중 프로바이더 지원 | `providers/anthropic.ts`, `openai.ts`, `gemini.ts` | 구현 완료 |
| 플랜 생성 프롬프트 | `prompts/planGeneration.ts` | 구현 완료 |
| 콘텐츠 추천 프롬프트 | `prompts/contentRecommendation.ts` | 구현 완료 |
| 하이브리드 생성 (AI + 스케줄러) | `actions/generateHybridPlanComplete.ts` | 구현 완료 |
| Gemini Grounding (웹 검색) | `providers/gemini.ts` | 구현 완료 |
| 스트리밍 생성 | `actions/streamPlan.ts` | 구현 완료 |
| 부분 재생성 | `actions/regeneratePartial.ts` | 구현 완료 |
| 플랜 검증 | `validators/enhancedPlanValidator.ts` | 구현 완료 |
| 캐싱/최적화 서비스 | `services/*.ts` | 구현 완료 |

### 현재 문제점

1. **프로젝트 규모 과대화**: 고려사항이 많아 구현 범위가 과도하게 확장됨
2. **사이드 이펙트 다수 발생**: 복잡한 의존성으로 인한 예상치 못한 문제
3. **실제 테스트 미진행**: API 요금 문제로 End-to-End 테스트 부재
4. **결과물 불명확**: 정확한 구성과 예상 결과물에 대한 확신 부족

---

## 3. 구현하고 싶은 핵심 플로우

### 목표: 단일 학생 기준 학습 플랜 생성 완성

```
[입력]
학생 사전 정보 취합
    ↓
[처리]
Gemini Grounding으로 콘텐츠 추천
    ↓
[출력]
서비스 형식에 맞춘 학습 일정 생성
```

### 필요한 입력 정보

- 학생 성적 데이터
- 학습 목표 (대학/전공)
- 학습 가능 시간
- 학습 기간
- 제외 날짜/요일

### 기대 출력

- 추천 콘텐츠 목록 (교재/강의)
- 일별 학습 스케줄
- 과목별 시간 배분

---

## 4. 현재 장애물

### API 요금 문제

| 프로바이더 | Free Tier 제한 | 현재 상황 |
|-----------|---------------|----------|
| Google Gemini | 15 RPM, 1M TPM | 제한치 초과로 테스트 불가 |
| OpenAI | 없음 (유료) | 미테스트 |
| Anthropic | 없음 (유료) | 미테스트 |

### Gemini Free Tier 구체적 제한

```
- 분당 15 요청 (RPM)
- 분당 100만 토큰 (TPM)
- 일당 1,500 요청 (RPD)
```

현재 구현에서 한 번의 플랜 생성에 필요한 토큰:
- 입력: 약 2,000~5,000 토큰 (학생 정보 + 콘텐츠 목록)
- 출력: 약 3,000~8,000 토큰 (주간 매트릭스)

→ **단일 요청은 가능하나, 반복 테스트 시 Rate Limit 도달**

---

## 5. 멘토에게 질문

### 질문 1: 개발 접근 방식

현재 두 가지 선택지가 있습니다:

**Option A: 단계별 쪼개기**
- 각 기능(추천, 일정생성, 검증)을 독립적으로 테스트
- Mock 데이터로 로직 검증 후 실제 API 연동
- 장점: 비용 절감, 단계별 검증
- 단점: 통합 시 예상치 못한 문제 가능

**Option B: 결제 후 전체 테스트**
- 실제 API로 End-to-End 테스트 진행
- 실제 데이터로 결과물 품질 확인
- 장점: 실제 동작 확인, 빠른 피드백
- 단점: 비용 발생, 디버깅 시 비용 증가

→ **어떤 접근 방식을 추천하시나요?**

### 질문 2: 프로젝트 범위 축소

현재 구현된 기능이 과도하게 많습니다:
- 3개 AI 프로바이더 지원
- 8개 서버 액션
- 7개 서비스
- 하이브리드/스트리밍/부분재생성 등

→ **MVP로 어떤 기능만 남기고 나머지는 제거해야 할까요?**

### 질문 3: Gemini Grounding 활용도

Gemini의 Grounding(웹 검색) 기능을 콘텐츠 추천에 활용하려 했는데:
- 실시간 교재/강의 정보 검색
- 최신 입시 트렌드 반영

→ **교육 콘텐츠 추천에 웹 검색이 적합한 방식인가요? 아니면 자체 DB 기반이 더 나을까요?**

### 질문 4: 테스트 전략

API 비용을 최소화하면서 효과적으로 테스트하려면:

1. **단위 테스트**: Mock으로 로직 검증
2. **통합 테스트**: 최소 API 호출로 E2E 검증
3. **회귀 테스트**: 변경 시 영향 확인

→ **LLM 기반 기능의 테스트 전략에 대한 조언을 부탁드립니다.**

---

## 6. 제안받고 싶은 방향

### 이상적인 결과

1. **단순화된 플로우**: 입력 → AI 처리 → 출력의 명확한 파이프라인
2. **검증된 결과물**: 실제 사용 가능한 학습 플랜
3. **유지보수 가능한 코드**: 이해하기 쉽고 수정하기 쉬운 구조

### 구체적으로 알고 싶은 것

1. 현재 구현 중 **살릴 부분**과 **버릴 부분**
2. **최소 비용**으로 테스트하는 방법
3. **우선순위** 설정 (무엇부터 해야 하는지)
4. 비슷한 프로젝트의 **레퍼런스**나 **베스트 프랙티스**

---

## 7. 참고: 현재 코드 구조

```
lib/domains/plan/llm/
├── client.ts                          # 통합 LLM 클라이언트
├── providers/                         # 3개 프로바이더
│   ├── anthropic.ts
│   ├── openai.ts
│   └── gemini.ts (Grounding 포함)
├── prompts/                           # 7개 프롬프트
│   ├── planGeneration.ts              # 플랜 생성
│   ├── contentRecommendation.ts       # 콘텐츠 추천
│   ├── enhancedContentRecommendation.ts
│   ├── frameworkGeneration.ts         # AI 프레임워크
│   ├── planOptimization.ts            # 플랜 최적화
│   ├── difficultyAssessment.ts        # 난이도 평가
│   └── partialRegeneration.ts         # 부분 재생성
├── actions/                           # 8개 서버 액션
│   ├── generatePlan.ts
│   ├── streamPlan.ts
│   ├── generateHybridPlanComplete.ts
│   ├── recommendContent.ts
│   ├── enhancedRecommendContent.ts
│   ├── optimizePlan.ts
│   └── regeneratePartial.ts
├── services/                          # 7개 서비스
│   ├── llmCacheService.ts
│   ├── providerSelectionService.ts
│   ├── tokenOptimizationService.ts
│   ├── contentDifficultyService.ts
│   ├── prerequisiteService.ts
│   ├── personalizedMatchingService.ts
│   └── webSearchContentService.ts
└── validators/                        # 2개 검증기
    ├── planValidator.ts
    └── enhancedPlanValidator.ts
```

---

## 8. 요약

| 항목 | 내용 |
|------|------|
| **목표** | 단일 학생 기준 AI 학습 플랜 생성 완성 |
| **현재 상태** | 코드 구현 완료, 실제 테스트 미진행 |
| **장애물** | API 요금, 프로젝트 복잡도 |
| **핵심 질문** | 단계별 진행 vs 결제 테스트, MVP 범위 설정 |
