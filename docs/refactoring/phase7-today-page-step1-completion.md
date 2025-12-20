# Phase 7: Today 페이지 최적화 - Step 1 완료 리포트

## 작업 일시
2024-12-21

## 목표
`app/(student)/today/page.tsx`의 데이터 로딩 방식을 React Query의 `prefetchQuery`와 `HydrationBoundary`를 사용하는 패턴으로 전환합니다.

---

## 완료된 작업

### 1. `lib/hooks/useTodayPlans.ts` 생성 ✅

**구현 내용:**
- `todayPlansQueryOptions` 함수 생성
  - Query Key: `["todayPlans", studentId, tenantId, date, { camp, includeProgress }]`
  - API 엔드포인트: `/api/today/plans`
  - 에러 처리: 표준화된 에러 메시지 파싱
  - 캐시 전략: `CACHE_STALE_TIME_DYNAMIC` (1분), `CACHE_GC_TIME_DYNAMIC` (10분)

- `useTodayPlans` 커스텀 훅 생성
  - `useTypedQuery` 래핑
  - 타입 안전성 보장
  - `enabled` 옵션으로 조건부 실행 지원

**특징:**
- ✅ 타입 안전성: `TodayPlansResponse` 타입 사용
- ✅ 에러 처리: API 응답 형식에 맞춘 에러 파싱
- ✅ 캐싱: React Query의 자동 캐싱 활용
- ✅ Server Prefetching 지원: `queryOptions` 패턴으로 서버에서도 사용 가능

---

### 2. `app/(student)/today/page.tsx` 수정 ✅

**변경 사항:**

#### Before:
```typescript
// 직접 getTodayPlans 호출
const todayPlansDataPromise = getTodayPlans({
  studentId: userId,
  tenantId: tenantContext?.tenantId || null,
  date: targetProgressDate,
  camp: false,
  includeProgress: false,
  narrowQueries: true,
  useCache: true,
  cacheTtlSeconds: 120,
}).catch((error) => {
  console.error("[TodayPage] todayPlans 조회 실패", error);
  return null;
});

const [todayPlansData] = await Promise.all([todayPlansDataPromise]);

// initialData로 props 전달
<TodayPlansSection
  initialPlansData={plansDataForContext}
/>
```

#### After:
```typescript
// React Query prefetchQuery 사용
const queryClient = getQueryClient();

try {
  await queryClient.prefetchQuery(
    todayPlansQueryOptions(
      userId,
      tenantContext?.tenantId || null,
      targetProgressDate,
      {
        camp: false,
        includeProgress: false,
      }
    )
  );
} catch (error) {
  console.error("[TodayPage] todayPlans prefetch 실패", error);
}

// HydrationBoundary로 감싸서 클라이언트로 전달
<HydrationBoundary state={dehydrate(queryClient)}>
  <TodayPageContextProvider>
    <TodayPlansSection
      // initialPlansData 제거 (React Query 캐시 사용)
    />
  </TodayPageContextProvider>
</HydrationBoundary>
```

**주요 변경점:**
- ✅ `getTodayPlans` 직접 호출 제거
- ✅ `queryClient.prefetchQuery` 사용
- ✅ `HydrationBoundary`와 `dehydrate` 적용
- ✅ `initialPlansData` props 제거 (다음 단계에서 클라이언트 컴포넌트 수정 필요)
- ✅ 에러 처리: Prefetch 실패 시에도 페이지 렌더링 가능

---

## 다음 단계

### Phase 7.3: 클라이언트 컴포넌트 전환 (Pending)

**대상 파일:**
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/TodayPlansSection.tsx`

**작업 내용:**
1. `PlanViewContainer`에서 `fetch` 제거
2. `useTodayPlans` 훅 사용
3. `initialData` props 제거
4. React Query의 자동 리페칭 활용

---

## 예상 효과

### 성능 개선
- **초기 로딩**: Server Prefetching으로 클라이언트에서 즉시 데이터 사용 가능
- **Waterfall 방지**: 서버에서 미리 데이터를 로드하여 클라이언트 대기 시간 감소
- **네트워크 요청 감소**: React Query 캐싱으로 동일 데이터 반복 요청 방지

### 개발자 경험 개선
- **타입 안전성**: TypeScript로 쿼리 결과 타입 보장
- **에러 처리 표준화**: React Query의 일관된 에러 처리
- **코드 간소화**: 수동 로딩 상태 관리 제거 예정

---

## 주의사항

1. **하위 호환성**: 현재 `TodayPlansSection`은 여전히 `initialPlansData`를 받을 수 있지만, 다음 단계에서 제거 예정
2. **에러 처리**: Prefetch 실패 시에도 페이지가 렌더링되도록 `try-catch` 적용
3. **캐시 전략**: `staleTime: 1분`으로 설정하여 빈번한 재요청 방지

---

## 테스트 체크리스트

- [ ] Today 페이지 정상 로딩 확인
- [ ] Prefetch된 데이터가 클라이언트에서 즉시 사용되는지 확인
- [ ] 날짜 변경 시 자동 리페칭 동작 확인
- [ ] 에러 발생 시 페이지가 정상적으로 렌더링되는지 확인
- [ ] React Query Devtools에서 쿼리 상태 확인

