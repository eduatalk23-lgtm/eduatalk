# Plan 타입 Export 수정

## 작업 일시
2025-02-04

## 문제 상황
TypeScript 컴파일 에러가 다수 발생했습니다:
- `@/lib/types/plan`에서 많은 타입들이 export되지 않는다는 에러
- `validatePhoneNumber` 함수를 찾을 수 없다는 에러

## 원인 분석

### 1. Plan 타입 Export 문제
`lib/types/plan.ts` 파일에서 `export * from "./plan"`을 사용했지만, 이것이 제대로 동작하지 않았습니다.
실제 타입 정의는 `lib/types/plan/index.ts`에 있고, 여기서 모든 타입을 re-export하고 있습니다.

### 2. validatePhoneNumber 함수 문제
`lib/utils/studentFormUtils.ts`에서 `validatePhoneNumber`를 re-export만 하고 있었지만, 같은 파일 내에서 함수를 사용할 때는 import가 필요했습니다.

## 해결 방법

### 1. Plan 타입 Export 수정
`lib/types/plan.ts`의 export 경로를 명시적으로 수정:
```typescript
// 변경 전
export * from "./plan";

// 변경 후
export * from "./plan/index";
```

### 2. validatePhoneNumber Import 추가
`lib/utils/studentFormUtils.ts`에서 함수를 사용하기 위해 import 추가:
```typescript
// import 추가
import {
  extractPhoneDigits,
  normalizePhoneNumber,
  formatPhoneNumber,
  validatePhoneNumber,
} from "./phone";

// 기존 export 유지
export {
  extractPhoneDigits,
  normalizePhoneNumber,
  formatPhoneNumber,
  validatePhoneNumber,
};
```

## 수정된 파일
- `lib/types/plan.ts`: export 경로 수정
- `lib/utils/studentFormUtils.ts`: validatePhoneNumber import 추가

## 결과
- TypeScript 컴파일 에러 313개 모두 해결
- 모든 타입이 정상적으로 export되어 다른 파일에서 사용 가능
- 함수 호출도 정상적으로 작동

## 영향 범위
이 변경으로 다음 타입들이 정상적으로 export됩니다:
- `PlanGroup`, `PlanContent`, `PlanExclusion`, `AcademySchedule`
- `ContentMaster`, `MasterBook`, `MasterLecture`, `MasterCustomContent`
- `PlanGroupCreationData`, `SchedulerOptions`, `TimeSettings`
- 기타 plan 관련 모든 타입들

