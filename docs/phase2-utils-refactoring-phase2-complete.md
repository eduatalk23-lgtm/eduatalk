# Phase 2 Utils 리팩토링 - Phase 2 완료 보고

## 작업 개요

Phase 2 (로직 분리 및 순수 함수화) 작업을 완료했습니다. 복잡한 로직을 테스트 가능하고 유지보수하기 쉬운 구조로 개선했습니다.

## 완료된 작업

### 2.1 planGroupTransform.ts 리팩토링 (의존성 주입) ✅

**문제점:**
- `transformPlanGroupToWizardData` 함수 내부에서 `classifyPlanContents`, `getTemplateBlockSetId`, `getCampTemplate`를 동적 import로 호출
- 사이드 이펙트 발생 (함수 내부에서 외부 데이터 페칭)
- 테스트 어려움 (mock 데이터 주입 불가)

**해결:**
- `TransformationContext` 타입 정의
  - `classifiedContents`: 콘텐츠 분류 결과 (외부에서 주입)
  - `templateData`: 캠프 템플릿 데이터 (외부에서 주입)
    - `exclusions`: 템플릿 제외일
    - `academySchedules`: 템플릿 학원 일정
    - `blockSetId`: 템플릿 block_set_id
- `transformPlanGroupToWizardDataPure` 함수 생성 (순수 함수)
  - async 제거 (동기 함수)
  - context 객체로 외부 의존성 주입
  - 테스트 가능한 구조
- 기존 함수는 래퍼로 유지 (하위 호환성)
  - 내부적으로 외부 의존성 조회 후 순수 함수 호출
  - 기존 호출부 변경 불필요

**변경 사항:**
- `lib/utils/planGroupTransform.ts`
  - `TransformationContext` 타입 추가
  - `transformPlanGroupToWizardDataPure` 함수 추가 (순수 함수)
  - 기존 `transformPlanGroupToWizardData` 함수는 내부적으로 순수 함수 호출

**하위 호환성:**
- 기존 함수 시그니처 유지
- 모든 호출부 변경 불필요
- 점진적 마이그레이션 가능

### 2.2 databaseFallback.ts 일반화 ✅

**문제점:**
- `isColumnMissingError`가 특정 에러 코드(42703)에 하드코딩
- `withColumnFallback`이 컬럼 누락 에러만 처리
- 다른 에러 타입에 대한 fallback 처리 불가

**해결:**
- `withErrorFallback` 함수 생성 (범용 에러 fallback)
  - `shouldFallback` 함수를 파라미터로 받아 에러 판단 로직 주입
  - 다양한 에러 타입에 대응 가능
- 기존 함수는 헬퍼로 유지 (하위 호환성)
  - `isColumnMissingError`: 컬럼 누락 에러 판단 헬퍼
  - `withColumnFallback`: 내부적으로 `withErrorFallback` 호출

**변경 사항:**
- `lib/utils/databaseFallback.ts`
  - `withErrorFallback` 함수 추가 (범용 에러 fallback)
  - 기존 함수는 헬퍼로 유지

**사용 예시:**
```typescript
// 기존 방식 (여전히 동작)
const result = await withColumnFallback(
  () => query(),
  () => fallbackQuery(),
  "column_name"
);

// 새로운 방식 (범용)
const result = await withErrorFallback(
  () => query(),
  () => fallbackQuery(),
  (error) => error?.code === "42703" || error?.code === "42P01"
);
```

**하위 호환성:**
- 기존 함수 시그니처 유지
- 모든 호출부 변경 불필요
- 새로운 패턴 선택적 사용 가능

## 다음 단계

### Phase 3: 스타일링 시스템화

1. **Tailwind Config 확장**
   - Semantic Colors 시스템 추가
   - CSS Variables 활용

2. **CVA 도입**
   - class-variance-authority 패키지 사용
   - 컴포넌트 스타일 마이그레이션

### Phase 4: UI 컴포넌트 리팩토링

1. **Custom Hook 분리**
   - SchoolSelect에서 useSchoolSearch 훅 분리

2. **접근성 강화**
   - React.useId 도입
   - FormInput, FormField 개선

### Phase 5: 테스트 전략

1. **순수 함수 테스트**
   - `transformPlanGroupToWizardDataPure` 함수 테스트
   - phone.ts 함수들 테스트

2. **Hook 테스트**
   - useSchoolSearch (Phase 4에서 생성 예정)

## 참고 사항

- 모든 변경사항은 하위 호환성을 유지했습니다
- 기존 함수 시그니처가 그대로 동작합니다
- 새로운 패턴은 선택적으로 도입 가능합니다
- 테스트 작성이 용이한 구조로 개선되었습니다

