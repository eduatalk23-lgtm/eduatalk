# Phase 2 Utils 리팩토링 - Phase 1 완료 보고

## 작업 개요

Phase 1 (기반 다지기) 작업을 완료했습니다. Type & Core Utils의 구조를 정리하고 통합했습니다.

## 완료된 작업

### 1.1 plan.ts 타입 분할 ✅

**문제점:**
- `lib/types/plan.ts` 파일이 866줄로 거대함
- DB 스키마 타입, 비즈니스 로직 타입, 입력 타입이 혼재

**해결:**
- `lib/types/plan/` 디렉토리 생성
- `schema.ts`: Supabase DB 테이블과 1:1 매핑 타입 (Row, Insert, Update)
- `domain.ts`: 비즈니스 로직 타입 (PlanGroup, Plan, PlanContent 등)
- `input.ts`: 폼 입력 및 API 요청 타입 (PlanGroupCreationData 등)
- `index.ts`: 모든 타입을 re-export (Public API)

**하위 호환성:**
- 기존 `lib/types/plan.ts`는 `./plan`을 re-export하도록 변경
- 모든 기존 import 경로가 그대로 동작

**생성된 파일:**
- `lib/types/plan/schema.ts`
- `lib/types/plan/domain.ts`
- `lib/types/plan/input.ts`
- `lib/types/plan/index.ts`
- `lib/types/plan.ts` (re-export)

**백업:**
- 기존 `plan.ts`는 `plan.ts.backup`으로 백업됨

### 1.2 전화번호 유틸리티 통합 ✅

**문제점:**
- `lib/utils/phoneMasking.ts`: 마스킹 로직만 존재
- `lib/utils/studentFormUtils.ts`: 포맷팅, 정규화, 검증 로직 존재
- 중복된 `extractPhoneDigits` 로직
- 기능이 분산되어 있어 유지보수 어려움

**해결:**
- `lib/utils/phone.ts` 생성: 모든 전화번호 관련 기능 통합
  - `extractPhoneDigits`: 숫자만 추출 (공통)
  - `formatPhoneNumber`: 실시간 포맷팅 (입력 중)
  - `normalizePhoneNumber`: 정규화 (DB 저장용)
  - `maskPhoneNumber`: 마스킹 (UI 표시용)
  - `validatePhoneNumber`: 유효성 검증

**하위 호환성:**
- `phoneMasking.ts`: `maskPhoneNumber`를 re-export
- `studentFormUtils.ts`: 모든 전화번호 함수를 re-export

**생성된 파일:**
- `lib/utils/phone.ts` (새 통합 파일)

**수정된 파일:**
- `lib/utils/phoneMasking.ts` (re-export로 변경)
- `lib/utils/studentFormUtils.ts` (re-export로 변경)

### 1.3 날짜 유틸리티 점검 ✅

**확인 결과:**
- 날짜 유틸리티가 여러 파일에 분산되어 있음:
  - `lib/utils/date.ts`: 기본 날짜 유틸리티
  - `lib/date/calendarUtils.ts`: 캘린더 관련 날짜 유틸리티
  - `lib/date/reportDateUtils.ts`: 리포트 날짜 유틸리티
  - `app/(student)/today/_utils/dateDisplay.ts`: 오늘 관련 날짜 표시

**중복 발견:**
- `formatDateString` 함수가 두 곳에 다른 시그니처로 존재:
  - `lib/utils/date.ts`: `formatDateString(year, month, day) => string`
  - `lib/date/calendarUtils.ts`: `formatDateString(date: Date) => string`
- `parseDateString` 함수가 두 곳에 다른 시그니처로 존재:
  - `lib/utils/date.ts`: `parseDateString(dateStr: string) => { year, month, day }`
  - `lib/date/calendarUtils.ts`: `parseDateString(dateStr: string) => Date`

**결론:**
- 각 파일의 목적이 다르므로 즉시 통합하지 않음
- 추후 리팩토링 시 함수명을 구분하거나 통합 검토 필요
- 예: `formatDateStringFromParts`, `formatDateStringFromDate` 등으로 명확히 구분

## 다음 단계

### Phase 2: 로직 분리 및 순수 함수화

1. **planGroupTransform.ts 리팩토링**
   - 의존성 주입 패턴 적용
   - 동적 import 제거
   - 순수 함수로 변환

2. **databaseFallback.ts 일반화**
   - 범용 에러 판단 함수 주입
   - 다양한 에러 타입 지원

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
   - phone.ts 함수들
   - transformPlanGroupToWizardData (의존성 주입 후)

2. **Hook 테스트**
   - useSchoolSearch

## 참고 사항

- 모든 변경사항은 하위 호환성을 유지했습니다
- 기존 import 경로가 그대로 동작합니다
- 백업 파일은 추후 삭제 가능합니다 (`plan.ts.backup`)

