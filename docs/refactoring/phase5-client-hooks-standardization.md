# Phase 5: Client Hooks 표준화 및 Deprecated 코드 정리

## 작업 개요

Phase 5의 마무리 작업으로 클라이언트 사이드 데이터 페칭 훅을 표준화하고, 더 이상 사용되지 않는 deprecated 코드를 정리했습니다.

## 주요 변경사항

### 1. Client Hooks 표준화

#### `lib/hooks/usePlans.ts`

**이전:**

```typescript
import { useQuery, queryOptions } from "@tanstack/react-query";

function plansQueryOptions(studentId: string, tenantId: string | null, planDate: string) {
  return queryOptions({
    queryKey: ["plans", studentId, planDate] as const,
    queryFn: async (): Promise<Plan[]> => {
      // ...
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
  });
}

export function usePlans({ studentId, tenantId, planDate, enabled = true }: UsePlansOptions) {
  return useQuery({
    ...plansQueryOptions(studentId, tenantId, planDate),
    enabled,
  });
}
```

**이후:**

```typescript
import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";

export function plansQueryOptions(
  studentId: string,
  tenantId: string | null,
  planDate: string
) {
  return queryOptions({
    queryKey: ["plans", studentId, planDate] as const,
    queryFn: async (): Promise<Plan[]> => {
      // ...
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

export function usePlans({ studentId, tenantId, planDate, enabled = true }: UsePlansOptions) {
  return useTypedQuery({
    ...plansQueryOptions(studentId, tenantId, planDate),
    enabled,
  });
}
```

**개선 사항:**

1. `useTypedQuery` 훅 사용으로 타입 안전성 향상
2. `gcTime` 명시적 설정 추가
3. `plansQueryOptions`를 export하여 서버 컴포넌트에서 `prefetchQuery`로 재사용 가능
4. JSDoc 주석 추가

#### `lib/hooks/useCampStats.ts`

**이전:**

```typescript
import { useQuery, queryOptions } from "@tanstack/react-query";

function campAttendanceStatsQueryOptions(templateId: string) {
  return queryOptions({
    // ...
  });
}

export function useCampAttendanceStats(templateId: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...campAttendanceStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}
```

**이후:**

```typescript
import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";

export function campAttendanceStatsQueryOptions(templateId: string) {
  return queryOptions({
    // ...
  });
}

export function useCampAttendanceStats(templateId: string, options?: { enabled?: boolean }) {
  return useTypedQuery({
    ...campAttendanceStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}
```

**개선 사항:**

1. `useTypedQuery` 훅 사용으로 타입 안전성 향상
2. `campAttendanceStatsQueryOptions`, `campLearningStatsQueryOptions`를 export하여 서버 컴포넌트에서 재사용 가능
3. JSDoc 주석 추가

### 2. Deprecated 코드 정리

#### `lib/data/schools.ts`

**제거된 함수:**

```typescript
/**
 * @deprecated 통합 테이블에서는 중복 확인이 불필요
 * 기존 코드 호환을 위한 학교 중복 확인
 */
export async function checkSchoolDuplicate(
  name: string,
  type: SchoolTypeKor,
  regionId?: string | null,
  campusName?: string | null,
  excludeId?: string
): Promise<School | null> {
  // 새 테이블 구조에서는 읽기 전용이므로 항상 null 반환
  console.warn("[data/schools] checkSchoolDuplicate는 더 이상 사용되지 않습니다.");
  return null;
}
```

**제거 이유:**

- 실제로 사용되지 않음 (코드베이스 검색 결과 없음)
- 통합 테이블 구조에서는 읽기 전용이므로 중복 확인이 불필요
- 하위 호환성을 위한 빈 함수였음

**유지된 Deprecated 코드:**

다음 함수들은 하위 호환성을 위해 유지되었습니다:

- `School` 타입 (deprecated) - `AllSchoolsView` 또는 `SchoolSimple` 사용 권장
- `getSchools()` 함수 (deprecated) - `getAllSchools()` 사용 권장
- `getSchoolById()` 함수 (deprecated) - `getSchoolByUnifiedId()` 사용 권장
- `getSchoolByName()` 함수 (deprecated) - `searchAllSchools()` 사용 권장

#### `lib/data/studentScores.ts`

**개선된 Deprecated 주석:**

**이전:**

```typescript
// 레거시 타입 (하위 호환성 유지 - 필요시에만 사용)
/** @deprecated InternalScore를 사용하세요 */
export type SchoolScore = {
  // ...
};
```

**이후:**

```typescript
// ============================================
// 레거시 타입 (Deprecated - 하위 호환성 유지)
// ============================================

/**
 * @deprecated InternalScore를 사용하세요
 * 
 * 이 타입은 하위 호환성을 위해 유지되지만, 새로운 코드에서는 사용하지 마세요.
 * 대신 `InternalScore` 타입을 사용하세요.
 * 
 * @see InternalScore
 */
export type SchoolScore = {
  // ...
};
```

**개선 사항:**

1. 더 명확한 deprecated 주석 추가
2. 대체 타입(`InternalScore`) 명시
3. 사용 가이드라인 추가

## 개선 효과

### 1. 타입 안전성 향상

- `useTypedQuery` 훅 사용으로 타입 추론 자동화
- `queryOptions` 패턴으로 쿼리 키와 페칭 함수 분리
- 서버/클라이언트 컴포넌트에서 동일한 쿼리 옵션 재사용 가능

### 2. 캐시 설정 명시화

- `gcTime` 명시적 설정으로 캐시 유지 시간 관리
- `CACHE_GC_TIME_DYNAMIC` 상수 사용으로 일관성 유지

### 3. 코드 정리

- 사용되지 않는 deprecated 함수 제거
- 명확한 deprecated 주석으로 마이그레이션 가이드 제공

### 4. 재사용성 향상

- `queryOptions` 함수를 export하여 서버 컴포넌트에서 `prefetchQuery`로 재사용 가능
- 타입 안전한 쿼리 옵션 공유

## 변경된 파일 목록

### Client Hooks 표준화

- `lib/hooks/usePlans.ts` - `useTypedQuery` 사용, `gcTime` 추가, `plansQueryOptions` export
- `lib/hooks/useCampStats.ts` - `useTypedQuery` 사용, `campAttendanceStatsQueryOptions`, `campLearningStatsQueryOptions` export

### Deprecated 코드 정리

- `lib/data/schools.ts` - `checkSchoolDuplicate` 함수 제거
- `lib/data/studentScores.ts` - `SchoolScore` 타입의 deprecated 주석 개선

## 유지된 Deprecated 코드

다음 코드들은 하위 호환성을 위해 유지되었습니다:

### `lib/data/schools.ts`

- `School` 타입 (deprecated) - `AllSchoolsView` 또는 `SchoolSimple` 사용 권장
- `getSchools()` 함수 (deprecated) - `getAllSchools()` 사용 권장
- `getSchoolById()` 함수 (deprecated) - `getSchoolByUnifiedId()` 사용 권장
- `getSchoolByName()` 함수 (deprecated) - `searchAllSchools()` 사용 권장

### `lib/data/studentScores.ts`

- `SchoolScore` 타입 (deprecated) - `InternalScore` 사용 권장

## 다음 단계

Phase 5 리팩토링이 완료되었습니다. 다음 단계는:

1. 다른 클라이언트 훅들도 동일한 패턴으로 표준화
2. 성능 테스트 및 모니터링
3. 문서화 및 가이드라인 정리

## 참고

- `useTypedQuery` 훅: `lib/hooks/useTypedQuery.ts`
- 캐시 상수: `lib/constants/queryCache.ts`
- TanStack Query v5 문서: https://tanstack.com/query/latest

