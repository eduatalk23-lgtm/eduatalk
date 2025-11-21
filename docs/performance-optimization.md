# 성능 최적화 가이드

## 개요

이 문서는 애플리케이션의 성능 최적화 전략과 구현 방법을 설명합니다.

## 구현된 최적화 기능

### 1. React Query 캐싱

#### 설정
- `lib/providers/QueryProvider.tsx`: React Query Provider 설정
- 기본 staleTime: 1분
- 캐시 유지 시간: 5분
- 자동 리페치: 네트워크 재연결 시

#### 사용 예시
```typescript
import { usePlans } from "@/lib/hooks/usePlans";

function MyComponent() {
  const { data: plans, isLoading } = usePlans({
    studentId: "user-id",
    tenantId: "tenant-id",
    planDate: "2025-01-23",
  });

  if (isLoading) return <div>로딩 중...</div>;
  return <div>{/* 플랜 목록 */}</div>;
}
```

### 2. 클라이언트 사이드 캐싱

#### 기능
- `lib/utils/cache.ts`: sessionStorage 기반 캐싱
- TTL(Time To Live) 지원
- 자동 만료 처리

#### 사용 예시
```typescript
import { setCache, getCache, createCacheKey } from "@/lib/utils/cache";

// 캐시 저장
const cacheKey = createCacheKey("plans", studentId, planDate);
setCache(cacheKey, plans, 1000 * 60 * 5); // 5분

// 캐시 읽기
const cachedPlans = getCache(cacheKey);
```

### 3. 가상화 리스트

#### 기능
- `lib/components/VirtualizedList.tsx`: 긴 리스트를 효율적으로 렌더링
- 가시 영역만 렌더링하여 성능 향상
- Overscan 옵션으로 부드러운 스크롤

#### 사용 예시
```typescript
import { VirtualizedList } from "@/lib/components/VirtualizedList";

<VirtualizedList
  items={plans}
  itemHeight={120}
  containerHeight={600}
  renderItem={(plan, index) => <PlanCard plan={plan} />}
  overscan={3}
/>
```

### 4. 성능 유틸리티

#### 디바운스/쓰로틀
```typescript
import { debounce, throttle } from "@/lib/utils/performance";

// 디바운스: 마지막 호출만 실행
const debouncedSearch = debounce((query: string) => {
  // 검색 로직
}, 300);

// 쓰로틀: 일정 간격으로만 실행
const throttledScroll = throttle(() => {
  // 스크롤 로직
}, 100);
```

#### 메모이제이션
```typescript
import { memoize } from "@/lib/utils/performance";

const expensiveCalculation = memoize((input: number) => {
  // 비용이 큰 계산
  return result;
});
```

## 최적화 권장사항

### 1. 데이터 페칭
- 서버 컴포넌트에서 데이터 페칭 (기본)
- 클라이언트 컴포넌트에서는 React Query 사용
- 불필요한 리페치 방지

### 2. 리스트 렌더링
- 100개 이상의 아이템: `VirtualizedList` 사용
- 100개 미만: 일반 리스트 사용

### 3. 이미지 최적화
- Next.js `Image` 컴포넌트 사용
- `loading="lazy"` 속성 활용
- 적절한 이미지 크기 설정

### 4. 코드 스플리팅
- 동적 import 사용
- 큰 라이브러리는 필요 시에만 로드

```typescript
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <div>로딩 중...</div>,
  ssr: false, // 필요시에만
});
```

## 모니터링

### React Query DevTools
개발 환경에서 React Query DevTools를 사용하여 캐시 상태를 확인할 수 있습니다.

### 성능 측정
- Chrome DevTools Performance 탭
- React DevTools Profiler
- Next.js Bundle Analyzer

## 향후 개선 사항

1. **서비스 워커 캐싱**: 오프라인 지원
2. **이미지 CDN**: 이미지 로딩 최적화
3. **GraphQL**: 필요한 데이터만 페칭
4. **인덱스 DB**: 대용량 데이터 저장

