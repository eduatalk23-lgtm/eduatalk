# 클라이언트-서버 코드 분리 수정

## 작업 개요

클라이언트 컴포넌트에서 서버 전용 코드(`next/headers`)를 import하여 발생한 빌드 에러를 해결했습니다.

## 문제 상황

- **에러 메시지**: `You're importing a component that needs "next/headers". That only works in a Server Component`
- **위치**: `lib/supabase/server.ts`가 클라이언트 컴포넌트에서 import됨
- **원인**: 
  - `InternalScoreInput.tsx` (클라이언트 컴포넌트)가 `calculateSchoolYear` 함수를 `lib/data/studentTerms.ts`에서 import
  - `lib/data/studentTerms.ts`가 파일 상단에서 `createSupabaseServerClient`를 import
  - `createSupabaseServerClient`는 `next/headers`의 `cookies`를 사용하므로 서버 전용
  - 클라이언트 컴포넌트에서 이 파일을 import하면 빌드 에러 발생

## 해결 방법

`calculateSchoolYear` 함수를 별도의 유틸리티 파일로 분리하여 클라이언트와 서버 모두에서 사용 가능하도록 수정했습니다.

### 1. 새로운 유틸리티 파일 생성

**파일**: `lib/utils/schoolYear.ts`

```typescript
/**
 * 학년도 계산 헬퍼 함수
 * 
 * 현재 날짜를 기준으로 학년도를 계산합니다.
 * 한국의 학년도는 3월부터 시작하므로, 3월~12월은 해당 연도, 1월~2월은 전년도입니다.
 * 
 * 클라이언트와 서버 모두에서 사용 가능한 순수 함수입니다.
 */
export function calculateSchoolYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1~12

  // 3월~12월: 해당 연도, 1월~2월: 전년도
  if (month >= 3) {
    return year;
  } else {
    return year - 1;
  }
}
```

### 2. 기존 파일 수정

**파일**: `lib/data/studentTerms.ts`

- `calculateSchoolYear` 함수 제거
- `lib/utils/schoolYear`에서 re-export 추가 (하위 호환성 유지)

```typescript
// calculateSchoolYear는 lib/utils/schoolYear.ts로 이동했습니다.
// 클라이언트 컴포넌트에서도 사용 가능하도록 분리되었습니다.
export { calculateSchoolYear } from "@/lib/utils/schoolYear";
```

### 3. 클라이언트 컴포넌트 수정

**파일**: `app/(student)/scores/input/_components/InternalScoreInput.tsx`

```typescript
// 변경 전
import { calculateSchoolYear } from "@/lib/data/studentTerms";

// 변경 후
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
```

## 변경 사항 요약

### 새로 생성된 파일
- `lib/utils/schoolYear.ts` - 클라이언트/서버 공용 유틸리티

### 수정된 파일
- `lib/data/studentTerms.ts` - `calculateSchoolYear` 함수를 re-export로 변경
- `app/(student)/scores/input/_components/InternalScoreInput.tsx` - import 경로 변경

## 효과

1. **빌드 에러 해결**: 클라이언트 컴포넌트에서 서버 전용 코드를 import하지 않도록 수정
2. **코드 분리**: 클라이언트/서버 공용 유틸리티와 서버 전용 데이터 접근 함수 분리
3. **하위 호환성 유지**: 기존 서버 컴포넌트/액션에서 `lib/data/studentTerms`를 통해 import해도 작동

## 참고 사항

- `calculateSchoolYear`는 순수 함수이므로 클라이언트와 서버 모두에서 안전하게 사용 가능
- 다른 서버 전용 함수들(`getOrCreateStudentTerm`, `getStudentTerm`, `getStudentTerms`)은 `lib/data/studentTerms.ts`에 그대로 유지
- 클라이언트 컴포넌트에서는 `lib/utils/schoolYear`에서 직접 import하는 것을 권장

## 작업 일시

2024-11-29

