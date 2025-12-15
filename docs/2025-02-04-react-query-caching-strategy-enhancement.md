# React Query 캐싱 전략 강화 작업 완료

**작업 일시**: 2025-02-04  
**작업자**: AI Assistant

## 개요

React Query의 캐싱 전략을 강화하여 불필요한 네트워크 요청을 최소화하고 성능을 개선했습니다.

## 주요 변경사항

### 1. 캐시 전략 상수 정의

**파일**: `lib/constants/queryCache.ts` (신규 생성)

데이터 변경 빈도에 따라 staleTime을 분류한 상수를 정의했습니다:

- **STATIC**: 거의 변하지 않는 데이터 (마스터 데이터, 메타데이터) - 5분
- **STABLE**: 자주 변하지 않는 데이터 (블록 세트, 플랜 그룹) - 5분
- **DYNAMIC**: 자주 변하는 데이터 (플랜 목록, 스케줄 결과) - 1분
- **REALTIME**: 실시간 업데이트가 필요한 데이터 (활성 플랜) - 10초

각 카테고리별로 GC Time(캐시 유지 시간)도 정의했습니다.

### 2. QueryProvider 기본 설정 업데이트

**파일**: `lib/providers/QueryProvider.tsx`

- gcTime을 5분에서 10분으로 증가
- 기본 staleTime은 1분 유지 (Dynamic Data 기준)
- 주석 개선

### 3. usePlans 훅 staleTime 업데이트

**파일**: `lib/hooks/usePlans.ts`

- staleTime을 30초에서 1분(DYNAMIC 전략)으로 변경
- 캐시 전략 상수 import 및 적용

### 4. Step7ScheduleResult invalidateQueries 최적화

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`

**변경사항**:
- `refetchQueries` 제거: `invalidateQueries`만으로 충분하므로 중복 제거
- staleTime 상수 적용: 하드코딩된 값을 상수로 변경
- 플랜 생성 후 관련 쿼리만 정확히 무효화

**최적화 효과**:
- 불필요한 즉시 재조회 제거
- invalidate만으로 캐시 무효화 후 필요 시에만 자동 리페치

### 5. usePlanRealtimeUpdates queryKey 패턴 최적화

**파일**: `lib/realtime/usePlanRealtimeUpdates.ts`

**변경사항**:
- 플랜 업데이트 시: `["plans", planDate]` → `["plans", userId, planDate]`
- 세션 업데이트 시: `["sessions", planDate]` → `["sessions", userId, planDate]`

**최적화 효과**:
- 특정 사용자와 날짜에 해당하는 쿼리만 무효화
- 다른 사용자의 캐시에 영향 없음
- 더 정확한 캐시 무효화

### 6. PlanScheduleView staleTime 상수 적용

**파일**: `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`

- staleTime 및 gcTime을 캐시 전략 상수로 변경
- 코드 일관성 향상

## 변경된 파일 목록

1. `lib/constants/queryCache.ts` (신규)
2. `lib/providers/QueryProvider.tsx`
3. `lib/hooks/usePlans.ts`
4. `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`
5. `lib/realtime/usePlanRealtimeUpdates.ts`
6. `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`

## 기대 효과

1. **네트워크 요청 감소**: 긴 staleTime 적용으로 불필요한 리페치 감소
2. **성능 향상**: 캐시 활용률 증가로 로딩 시간 단축
3. **코드 일관성**: 하드코딩된 값 제거 및 상수화로 유지보수성 향상
4. **정확한 캐시 무효화**: queryKey 패턴 최적화로 필요한 쿼리만 무효화

## 주의사항

1. **서버 컴포넌트**: 마스터 콘텐츠 페이지는 서버 컴포넌트이므로 React Query를 사용하지 않습니다. Next.js `unstable_cache`를 계속 사용합니다.
2. **Realtime 업데이트**: 실시간 업데이트가 필요한 데이터는 짧은 staleTime을 유지했습니다.
3. **테스트 필요**: 실제 사용 환경에서 캐시 무효화가 올바르게 동작하는지 확인이 필요합니다.

## 검증 방법

1. React Query Devtools를 사용하여 쿼리 상태 모니터링
2. 플랜 생성 후 관련 쿼리만 무효화되는지 확인
3. 블록 세트 조회 시 5분간 캐시가 유지되는지 확인
4. 네트워크 탭에서 불필요한 요청이 감소했는지 확인

