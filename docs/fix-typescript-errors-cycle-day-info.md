# TypeScript 컴파일 오류 수정

## 작업 일시
2024년 12월

## 문제점

### 1. `CycleDayInfo` 타입 불일치
- **파일**: `__tests__/integration/strategyWeaknessAllocation.test.ts`
- **오류**: `week_number` 속성이 `CycleDayInfo` 타입에 존재하지 않음
- **원인**: 테스트 파일에서 사용한 속성명이 실제 타입 정의와 다름
  - 테스트에서 사용: `week_number`
  - 실제 타입 정의: `cycle_number` (주차 번호), `cycle_day_number` (주기 내 일자 번호)

### 2. `validateAllocations` 함수 import 누락
- **파일**: `app/(student)/actions/plan-groups/create.ts`
- **오류**: `validateAllocations` 함수를 찾을 수 없음
- **원인**: 함수를 사용하고 있지만 import 문이 없음

## 수정 내용

### 1. 테스트 파일 수정
`__tests__/integration/strategyWeaknessAllocation.test.ts`에서 모든 `CycleDayInfo` 객체를 올바른 타입에 맞게 수정:

```typescript
// 수정 전
{ date: "2024-01-01", day_type: "study", week_number: 1 }

// 수정 후
{ date: "2024-01-01", day_type: "study", cycle_day_number: 1, cycle_number: 1 }
```

**변경 사항**:
- `week_number` → `cycle_number` (주차 번호)
- `cycle_day_number` 추가 (주기 내 일자 번호, 1부터 시작)

**영향받은 테스트 케이스**:
- 전략과목 주당 배정 일수 정확도 테스트 (2일, 3일, 4일)
- 취약과목 전체 학습일 배정 테스트 (2개 케이스)

### 2. Import 문 추가
`app/(student)/actions/plan-groups/create.ts`에 `validateAllocations` 함수 import 추가:

```typescript
import { validateAllocations } from "@/lib/utils/subjectAllocation";
```

## 검증

TypeScript 컴파일 오류 확인:
```bash
npx tsc --noEmit
```

**결과**: 모든 오류 해결 (0 errors)

## 관련 파일

- `lib/plan/1730TimetableLogic.ts` - `CycleDayInfo` 타입 정의
- `lib/utils/subjectAllocation.ts` - `validateAllocations` 함수 정의
- `__tests__/integration/strategyWeaknessAllocation.test.ts` - 수정된 테스트 파일
- `app/(student)/actions/plan-groups/create.ts` - import 추가된 파일

## 참고

`CycleDayInfo` 타입 구조:
```typescript
export type CycleDayInfo = {
  date: string; // YYYY-MM-DD
  day_type: DayType; // "study" | "review" | "exclusion"
  cycle_day_number: number; // 주기 내 일자 번호 (1부터 시작)
  cycle_number: number; // 주차 번호 (1부터 시작)
};
```

