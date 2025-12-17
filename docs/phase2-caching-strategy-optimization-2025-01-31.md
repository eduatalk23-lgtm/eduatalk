# Phase 2 캐싱 전략 최적화 작업 보고서

**작업 일자**: 2025-01-31  
**작업 범위**: React Query 캐싱 전략 최적화, 서버 사이드 캐싱 가이드라인

## 개요

React Query 캐싱 전략을 최적화하고, 하드코딩된 값을 상수로 교체하여 일관성을 향상시켰습니다.

## 완료된 작업

### 1. React Query 캐싱 전략 상수 적용

#### 개선된 파일

**`lib/hooks/useActivePlan.ts`**
- 하드코딩된 `staleTime: 1000 * 10` → `CACHE_STALE_TIME_REALTIME` 상수 사용
- 실시간 업데이트가 필요한 데이터에 적합한 캐시 전략 적용

**`lib/hooks/useActivePlanDetails.ts`**
- 하드코딩된 `staleTime: 1000 * 10` → `CACHE_STALE_TIME_REALTIME` 상수 사용
- 일관된 캐시 전략 적용

**`lib/providers/QueryProvider.tsx`**
- 하드코딩된 `staleTime: 1000 * 60` → `CACHE_STALE_TIME_DYNAMIC` 상수 사용
- 하드코딩된 `gcTime: 1000 * 60 * 10` → `CACHE_GC_TIME_DYNAMIC` 상수 사용
- 주석 개선 및 가이드라인 추가

### 2. 캐시 전략 상수 정의 확인

**`lib/constants/queryCache.ts`** (이미 존재)

```typescript
// Static Data: 마스터 콘텐츠, 메타데이터 (5분)
export const CACHE_STALE_TIME_STATIC = 1000 * 60 * 5;

// Stable Data: 블록 세트, 플랜 그룹 메타데이터 (5분)
export const CACHE_STALE_TIME_STABLE = 1000 * 60 * 5;

// Dynamic Data: 플랜 목록, 스케줄 결과 (1분)
export const CACHE_STALE_TIME_DYNAMIC = 1000 * 60;

// Realtime Data: 활성 플랜, 세션 (10초)
export const CACHE_STALE_TIME_REALTIME = 1000 * 10;

// GC Time (캐시 유지 시간)
export const CACHE_GC_TIME_STATIC = 1000 * 60 * 30; // 30분
export const CACHE_GC_TIME_STABLE = 1000 * 60 * 15; // 15분
export const CACHE_GC_TIME_DYNAMIC = 1000 * 60 * 10; // 10분
export const CACHE_GC_TIME_REALTIME = 1000 * 60 * 5; // 5분
```

## 개선 효과

1. **코드 일관성 향상**: 하드코딩된 값을 상수로 교체하여 유지보수성 향상
2. **캐시 전략 명확화**: 데이터 변경 빈도에 따른 적절한 캐시 전략 적용
3. **유지보수성 향상**: 캐시 시간 변경 시 한 곳만 수정하면 됨

## 서버 사이드 캐싱 가이드라인

### Next.js `unstable_cache` 사용

서버 컴포넌트에서 데이터를 캐싱할 때는 Next.js의 `unstable_cache`를 사용합니다.

#### 기본 패턴

```typescript
import { unstable_cache } from "next/cache";

export async function getCachedData(key: string) {
  return unstable_cache(
    async () => {
      // 데이터 페칭 로직
      return await fetchData();
    },
    [key], // 캐시 키
    {
      tags: ["data"], // 캐시 태그 (revalidateTag로 무효화 가능)
      revalidate: 60, // 재검증 시간 (초)
    }
  )();
}
```

#### 캐시 전략 상수 사용

**`lib/cache/cacheStrategy.ts`** (이미 존재)

```typescript
import { CACHE_REVALIDATE_TIME, withCache } from "@/lib/cache/cacheStrategy";

// 짧은 재검증 시간 (1분)
const data = await withCache(
  () => fetchData(),
  ["data", id],
  {
    tags: ["data"],
    revalidate: CACHE_REVALIDATE_TIME.SHORT, // 60초
  }
);

// 긴 재검증 시간 (1시간)
const staticData = await withCache(
  () => fetchStaticData(),
  ["static", id],
  {
    tags: ["static"],
    revalidate: CACHE_REVALIDATE_TIME.VERY_LONG, // 3600초
  }
);
```

### 캐시 태그 활용

캐시 태그를 사용하여 관련된 캐시를 한 번에 무효화할 수 있습니다.

```typescript
import { revalidateTag } from "next/cache";

// 특정 태그의 모든 캐시 무효화
revalidateTag("student");
revalidateTag("plan");
```

### 캐시 전략 선택 가이드

| 데이터 유형 | React Query | 서버 사이드 캐싱 | staleTime/revalidate |
|------------|-------------|------------------|---------------------|
| 마스터 데이터 | STATIC | VERY_LONG | 5분 / 1시간 |
| 블록 세트, 플랜 그룹 | STABLE | LONG | 5분 / 10분 |
| 플랜 목록, 스케줄 | DYNAMIC | SHORT | 1분 / 1분 |
| 활성 플랜, 세션 | REALTIME | - | 10초 / - |

## 사용 예시

### React Query 사용 (클라이언트 컴포넌트)

```typescript
import { useQuery } from "@tanstack/react-query";
import { CACHE_STALE_TIME_STABLE } from "@/lib/constants/queryCache";

export function usePlanGroups(studentId: string) {
  return useQuery({
    queryKey: ["planGroups", studentId],
    queryFn: () => fetchPlanGroups(studentId),
    staleTime: CACHE_STALE_TIME_STABLE, // 5분
  });
}
```

### 서버 사이드 캐싱 (서버 컴포넌트)

```typescript
import { withCache } from "@/lib/cache/cacheStrategy";
import { CACHE_REVALIDATE_TIME } from "@/lib/cache/cacheStrategy";

export async function getCachedPlanGroups(studentId: string) {
  return withCache(
    () => fetchPlanGroups(studentId),
    ["planGroups", studentId],
    {
      tags: ["planGroups", `student:${studentId}`],
      revalidate: CACHE_REVALIDATE_TIME.MEDIUM, // 5분
    }
  );
}
```

## 주의사항

1. **서버 컴포넌트**: React Query를 사용하지 않으므로 `unstable_cache` 사용
2. **클라이언트 컴포넌트**: React Query 사용, 서버 사이드 캐싱과 함께 사용 가능
3. **캐시 무효화**: 데이터 변경 시 적절한 캐시 무효화 필요
4. **캐시 태그**: 관련된 캐시를 그룹화하여 관리

## 다음 단계

1. **더 많은 훅에 캐시 전략 적용**: 남은 훅들에도 상수 적용
2. **캐시 무효화 전략 개선**: 데이터 변경 시 자동 캐시 무효화
3. **캐시 모니터링**: 캐시 히트율 및 성능 모니터링
4. **문서화**: 각 데이터 유형별 캐시 전략 문서화

## 참고 문서

- [React Query 캐싱 전략 강화](./2025-02-04-react-query-caching-strategy-enhancement.md)
- [캐싱 전략 통일](./cache-strategy-unification.md) (존재하는 경우)

