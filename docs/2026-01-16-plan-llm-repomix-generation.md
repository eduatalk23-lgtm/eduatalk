# 플랜 생성 AI/LLM 서비스 Repomix 생성

> 작성일: 2026-01-16  
> 목적: 플랜 생성과 관련된 AI/LLM 서비스 코드를 repomix로 추출하여 문서화

## 작업 개요

플랜 생성과 관련된 AI/LLM 서비스를 `npx repomix`를 사용하여 단일 XML 파일로 추출했습니다.

## 생성된 파일

- **출력 파일**: `plan-llm-domain.repomix.xml`
- **설정 파일**: `repomix.config.ts`

## 포함된 파일 통계

- **총 파일 수**: 105개
- **총 토큰 수**: 274,019 tokens
- **총 문자 수**: 934,423 chars
- **파일 크기**: 약 1MB

## 포함된 주요 디렉토리 및 파일

### 1. LLM 플랜 생성 핵심 로직
- `lib/domains/plan/llm/**` (전체)
  - `actions/`: 플랜 생성 액션들
    - `generatePlan.ts`: 메인 플랜 생성
    - `streamPlan.ts`: 스트리밍 플랜 생성
    - `recommendContent.ts`: 콘텐츠 추천
    - `optimizePlan.ts`: 플랜 최적화
    - `generateHybridPlanComplete.ts`: 하이브리드 플랜 생성
  - `providers/`: LLM 프로바이더 (Anthropic, OpenAI, Gemini)
  - `prompts/`: 프롬프트 템플릿
  - `transformers/`: 요청/응답 변환기
  - `services/`: 서비스 레이어
    - `aiUsageLogger.ts`: AI 사용량 로깅
    - `llmCacheService.ts`: LLM 캐시 서비스
    - `webSearchContentService.ts`: 웹 검색 서비스
    - `personalizedMatchingService.ts`: 맞춤형 매칭 서비스
    - `prerequisiteService.ts`: 선수지식 서비스
  - `types.ts`: 타입 정의
  - `client.ts`: LLM 클라이언트

### 2. 관리자용 배치 AI 플랜 생성
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`
- `lib/domains/admin-plan/actions/aiPlanGeneration.ts`

### 3. AI UI 컴포넌트
- `components/ai/ProviderSelector.tsx`
- `app/(student)/plan/new-group/_components/_features/ai-mode/`
- `app/(admin)/admin/students/**/plans/**/*WebSearch*.tsx`
- `app/(admin)/admin/students/**/plans/**/*AI*.tsx`

### 4. 관련 문서
- `docs/**/*ai*.md`
- `docs/**/*llm*.md`
- `docs/**/plan-generation*.md`
- `docs/architecture/plan-generation*.md`
- `docs/ai-integration*.md`
- `docs/mentor-question-ai*.md`

## Top 5 파일 (토큰 기준)

1. `docs/plan-enhancement/TDD-plan-domain-enhancement.md` (9,354 tokens)
2. `lib/domains/plan/llm/prompts/planGeneration.ts` (8,577 tokens)
3. `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts` (8,067 tokens)
4. `docs/plan-generation-comprehensive-guide.md` (7,881 tokens)
5. `lib/domains/plan/llm/services/personalizedMatchingService.ts` (7,127 tokens)

## Repomix 설정 파일

`repomix.config.ts` 파일을 생성하여 다음을 포함하도록 설정했습니다:

```typescript
{
  include: [
    "lib/domains/plan/llm/**",
    "lib/domains/admin-plan/actions/batchAIPlanGeneration.ts",
    "components/ai/**",
    // ... 기타 관련 파일
  ],
  exclude: [
    "node_modules/**",
    "**/*.test.ts",
    "**/__tests__/**",
  ],
}
```

## 사용 방법

생성된 `plan-llm-domain.repomix.xml` 파일은:

1. **AI 분석**: 플랜 생성 AI/LLM 서비스의 전체 구조를 한눈에 파악
2. **코드 리뷰**: 관련 코드를 한 파일에서 검토
3. **문서화**: 시스템 아키텍처 이해 및 문서 작성
4. **온보딩**: 신규 개발자에게 플랜 생성 시스템 소개

## 참고 사항

- 이 파일은 읽기 전용입니다. 원본 파일을 수정해야 합니다.
- 보안 정보가 포함될 수 있으므로 주의해서 다루어야 합니다.
- 바이너리 파일은 포함되지 않습니다.
- 테스트 파일은 제외되었습니다.

## 다음 단계

필요시 다음 작업을 수행할 수 있습니다:

1. 특정 기능만 추출하여 별도 repomix 파일 생성
2. 주기적으로 업데이트하여 최신 상태 유지
3. CI/CD 파이프라인에 통합하여 자동 생성

