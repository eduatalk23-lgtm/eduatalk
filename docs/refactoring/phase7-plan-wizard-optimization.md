# Phase 7: Plan 생성 마법사 최적화 완료

## 📋 작업 개요

**작업 일시**: 2025-01-XX  
**작업 범위**: Plan 생성 마법사(`app/(student)/plan/new-group/page.tsx`)의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 전환

---

## ✅ 완료된 작업

### 1. 블록 세트 목록 조회 훅 생성

**파일**: `lib/hooks/useBlockSets.ts`

- `blockSetsQueryOptions`: 블록 세트 목록 조회 쿼리 옵션 생성
- `useBlockSets`: 블록 세트 목록 조회 클라이언트 훅
- 타입 안전성 보장 (`BlockSetWithBlocks` 타입 사용)
- 캐시 전략: `staleTime: 1분`, `gcTime: 10분` (Dynamic Data)

**주요 특징**:
- `queryOptions` 패턴 사용으로 타입 안전성 향상
- 서버 컴포넌트에서 `prefetchQuery`로 사용 가능
- 클라이언트 컴포넌트에서 `useTypedQuery`로 사용

```typescript
// 서버 컴포넌트에서 사용
await queryClient.prefetchQuery(blockSetsQueryOptions(studentId));

// 클라이언트 컴포넌트에서 사용
const { data: blockSets, isLoading } = useBlockSets({ studentId });
```

---

### 2. 학생 콘텐츠 목록 조회 훅 생성

**파일**: `lib/hooks/useStudentContents.ts`

- `studentContentsQueryOptions`: 학생 콘텐츠 목록 조회 쿼리 옵션 생성
- `useStudentContents`: 학생 콘텐츠 목록 조회 클라이언트 훅
- 타입 안전성 보장 (`ContentItem[]` 타입 사용)
- 캐시 전략: `staleTime: 1분`, `gcTime: 10분` (Dynamic Data)

**반환 타입**:
```typescript
{
  books: ContentItem[];
  lectures: ContentItem[];
  custom: ContentItem[];
}
```

---

### 3. Plan 생성 마법사 페이지 리팩토링

**파일**: `app/(student)/plan/new-group/page.tsx`

#### 변경 사항

**Before**:
- 서버 컴포넌트에서 직접 `fetchBlockSetsWithBlocks`와 `fetchAllStudentContents` 호출
- 데이터를 props로 Wizard 컴포넌트에 전달

**After**:
- `prefetchQuery` + `HydrationBoundary` 패턴 적용
- 서버에서 데이터 프리패칭만 수행
- Wizard 컴포넌트에서 훅을 통해 데이터 조회

#### 주요 개선점

1. **Server Prefetching**: 
   - `getQueryClient()`로 QueryClient 인스턴스 생성
   - `blockSetsQueryOptions`와 `studentContentsQueryOptions`를 사용하여 데이터 프리패칭
   - `HydrationBoundary`로 서버 상태를 클라이언트에 전달

2. **인증 처리 개선**:
   - `getCurrentUser()` 사용 (기존 `supabase.auth.getUser()` 대신)
   - `getTenantContext()` 사용하여 테넌트 정보 조회

3. **Props 간소화**:
   - `studentId`만 전달 (데이터는 훅으로 조회)
   - `initialBlockSets`와 `initialContents` props 제거

---

### 4. PlanGroupWizard 컴포넌트 최적화

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

#### 변경 사항

1. **Props 타입 변경**:
   - `studentId` 필수 prop 추가
   - `initialBlockSets`, `initialContents` 선택적 prop 유지 (하위 호환성)

2. **훅 사용**:
   ```typescript
   // 블록 세트 조회
   const { data: blockSetsData, isLoading: isLoadingBlockSets } = useBlockSets({
     studentId,
     enabled: !initialBlockSets, // initialBlockSets가 있으면 훅 비활성화
   });
   
   // 콘텐츠 목록 조회
   const { data: contentsData, isLoading: isLoadingContents } = useStudentContents({
     studentId,
     enabled: !initialContents, // initialContents가 있으면 훅 비활성화
   });
   ```

3. **Fallback 처리**:
   - `initialBlockSets`나 `initialContents`가 제공되면 우선 사용
   - 없으면 훅으로 조회한 데이터 사용

4. **쿼리 무효화**:
   - 플랜 생성 완료 시 `planGroups` 쿼리 무효화
   - 목록 페이지로 돌아갔을 때 최신 데이터 표시

```typescript
// 플랜 그룹 활성화 후 쿼리 무효화
await updatePlanGroupStatus(draftGroupId, "active");

// 플랜 그룹 목록 쿼리 무효화 (최신 데이터 표시)
queryClient.invalidateQueries({
  queryKey: ["planGroups"],
});
```

---

## 🎯 적용된 패턴

### Server Prefetching 패턴

1. **서버 컴포넌트에서 프리패칭**:
   ```typescript
   const queryClient = getQueryClient();
   await Promise.all([
     queryClient.prefetchQuery(blockSetsQueryOptions(studentId)),
     queryClient.prefetchQuery(studentContentsQueryOptions(studentId)),
   ]);
   ```

2. **HydrationBoundary**:
   ```typescript
   <HydrationBoundary state={dehydrate(queryClient)}>
     <PlanGroupWizard studentId={user.userId} />
   </HydrationBoundary>
   ```

3. **클라이언트 훅 사용**:
   ```typescript
   const { data: blockSets } = useBlockSets({ studentId });
   const { data: contents } = useStudentContents({ studentId });
   ```

---

## 📊 성능 개선

### Before
- 서버에서 모든 데이터를 한 번에 로드
- 클라이언트에서 데이터 변경 시 서버 재요청 필요
- Props drilling으로 인한 복잡성

### After
- 서버에서 데이터 프리패칭만 수행
- 클라이언트에서 React Query 캐시 활용
- 훅을 통한 선언적 데이터 조회
- 쿼리 무효화를 통한 자동 데이터 갱신

---

## 🔄 데이터 흐름

```
1. 서버 컴포넌트 (page.tsx)
   ├─ getCurrentUser() - 사용자 정보 조회
   ├─ getTenantContext() - 테넌트 정보 조회
   ├─ queryClient.prefetchQuery() - 블록 세트, 콘텐츠 프리패칭
   └─ studentId를 props로 전달

2. HydrationBoundary
   └─ 서버 상태를 클라이언트에 전달

3. 클라이언트 컴포넌트 (PlanGroupWizard)
   ├─ useBlockSets() - 캐시된 블록 세트 조회
   ├─ useStudentContents() - 캐시된 콘텐츠 조회
   ├─ initialBlockSets/initialContents 우선 사용 (fallback)
   └─ UI 렌더링

4. 플랜 생성 완료 시
   ├─ updatePlanGroupStatus() - 플랜 그룹 활성화
   ├─ queryClient.invalidateQueries() - 쿼리 무효화
   └─ router.push() - 상세 페이지로 이동
```

---

## 🚧 향후 개선 사항

### 캠프 관리 페이지 최적화 (미완료)

**현재 상태**:
- `lib/hooks/useCampStats.ts`가 이미 존재
- `app/(admin)/camp/` 경로는 확인되지 않음 (student 경로만 존재)

**개선 방향**:
1. 캠프 관리 페이지가 있다면 `useCampStats` 훅 활용
2. 템플릿 목록 조회 시 React Query 훅 사용
3. 서버 사이드 프리패칭 적용

**참고**: admin 경로가 없는 것으로 보아 별도 작업으로 진행 권장

---

## 📝 변경된 파일 목록

### 신규 생성
- `lib/hooks/useBlockSets.ts` - 블록 세트 목록 조회 훅
- `lib/hooks/useStudentContents.ts` - 학생 콘텐츠 목록 조회 훅

### 수정
- `app/(student)/plan/new-group/page.tsx` - Server Prefetching 패턴 적용
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 훅 사용 및 쿼리 무효화

---

## ✅ 검증 사항

- [x] 린트 에러 없음
- [x] TypeScript 타입 안전성 보장
- [x] Server Prefetching 정상 동작
- [x] 클라이언트 훅 정상 동작
- [x] 하위 호환성 유지 (initialBlockSets/initialContents)
- [x] 쿼리 무효화 정상 동작
- [x] 플랜 생성 완료 후 목록 페이지 최신 데이터 표시

---

## 🎉 완료

Plan 생성 마법사의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 성공적으로 전환했습니다. Plan 목록 페이지와 동일한 패턴을 적용하여 일관성 있는 코드베이스를 유지하고 있습니다.

