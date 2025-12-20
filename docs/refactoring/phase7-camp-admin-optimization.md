# Phase 7: 캠프 관리 페이지 최적화 완료

## 📋 작업 개요

**작업 일시**: 2025-01-XX  
**작업 범위**: 캠프 관리 페이지(`app/(admin)/admin/camp-templates/`)의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 전환

---

## ✅ 완료된 작업

### 1. 캠프 템플릿 목록 조회 훅 생성

**파일**: `lib/hooks/useCampTemplates.ts`

- `campTemplatesQueryOptions`: 캠프 템플릿 목록 조회 쿼리 옵션 생성
- `useCampTemplates`: 캠프 템플릿 목록 조회 클라이언트 훅
- 타입 안전성 보장 (`CampTemplate[]` 타입 사용)
- 캐시 전략: `staleTime: 1분`, `gcTime: 10분` (Dynamic Data)
- 필터링 및 페이지네이션 지원

**주요 특징**:
- `queryOptions` 패턴 사용으로 타입 안전성 향상
- 서버 컴포넌트에서 `prefetchQuery`로 사용 가능
- 클라이언트 컴포넌트에서 `useTypedQuery`로 사용
- 검색, 상태, 프로그램 유형 필터 지원

```typescript
// 서버 컴포넌트에서 사용
await queryClient.prefetchQuery(
  campTemplatesQueryOptions(tenantId, {
    page: 1,
    pageSize: 20,
    filters: { search: "윈터", status: "active" },
  })
);

// 클라이언트 컴포넌트에서 사용
const { data, isLoading } = useCampTemplates({
  tenantId: "tenant-123",
  page: 1,
  pageSize: 20,
  filters: { search: "윈터" },
});
```

---

### 2. 캠프 템플릿 목록 페이지 리팩토링

**파일**: `app/(admin)/admin/camp-templates/page.tsx`

#### 변경 사항

**Before**:
- 서버 컴포넌트에서 직접 `getCampTemplatesForTenantWithPagination` 호출
- 데이터를 props로 클라이언트 컴포넌트에 전달
- 필터링 및 페이지네이션을 서버에서 처리

**After**:
- `prefetchQuery` + `HydrationBoundary` 패턴 적용
- 서버에서 데이터 프리패칭만 수행
- 클라이언트 컴포넌트에서 훅을 통해 데이터 조회

#### 주요 개선점

1. **Server Prefetching**: 
   - `getQueryClient()`로 QueryClient 인스턴스 생성
   - `campTemplatesQueryOptions`를 사용하여 데이터 프리패칭
   - `HydrationBoundary`로 서버 상태를 클라이언트에 전달

2. **권한 검사**:
   - `getCurrentUserRole()` 사용하여 admin/consultant 권한 확인
   - `getTenantContext()` 사용하여 테넌트 정보 조회

3. **에러 처리**:
   - Prefetch 실패 시에도 페이지 렌더링 계속 (에러 로깅만)

---

### 3. CampTemplatesListContainer 클라이언트 컴포넌트 생성

**파일**: `app/(admin)/admin/camp-templates/_components/CampTemplatesListContainer.tsx`

#### 역할

- `useCampTemplates` 훅을 사용하여 데이터 조회
- 필터링 및 페이지네이션을 클라이언트에서 처리
- 검색 폼 및 필터 UI 제공
- 로딩 상태 및 빈 상태 처리

#### 주요 기능

1. **데이터 조회**:
   ```typescript
   const { data: templatesData, isLoading } = useCampTemplates({
     tenantId,
     page,
     pageSize,
     filters: filterOptions,
   });
   ```

2. **필터링**:
   - 검색어 (템플릿명 또는 설명)
   - 상태 필터 (draft, active, archived)
   - 프로그램 유형 필터 (윈터캠프, 썸머캠프, 파이널캠프, 기타)

3. **페이지네이션**:
   - URL 파라미터와 동기화
   - 검색 시 첫 페이지로 리셋

4. **UI 렌더링**:
   - 로딩 상태: `SuspenseFallback` 표시
   - 빈 상태: 빈 상태 메시지 표시
   - 데이터 있을 때: 템플릿 목록 및 페이지네이션 표시

---

### 4. 캠프 리포트 페이지 리팩토링

**파일**: `app/(admin)/admin/camp-templates/[id]/reports/page.tsx`

#### 변경 사항

**Before**:
- 서버 컴포넌트에서 `generateCampFullReport` 직접 호출
- 리포트 데이터를 props로 클라이언트 컴포넌트에 전달

**After**:
- `prefetchQuery` + `HydrationBoundary` 패턴 적용
- `campAttendanceStatsQueryOptions`와 `campLearningStatsQueryOptions` 사용
- 클라이언트 컴포넌트에서 `useCampStats` 훅 사용

#### 주요 개선점

1. **Server Prefetching**:
   ```typescript
   await Promise.all([
     queryClient.prefetchQuery(campAttendanceStatsQueryOptions(id)),
     queryClient.prefetchQuery(campLearningStatsQueryOptions(id)),
   ]);
   ```

2. **클라이언트 훅 사용**:
   ```typescript
   const { attendance, learning, isLoading } = useCampStats(templateId);
   ```

3. **컴포넌트 수정**:
   - `CampReportDashboard`: `templateId`를 받아서 훅 사용
   - `CampReportSummaryCards`: `attendanceStats`와 `learningStats`를 별도로 받도록 변경

---

### 5. 캠프 출석 페이지 리팩토링

**파일**: `app/(admin)/admin/camp-templates/[id]/attendance/page.tsx`

#### 변경 사항

**Before**:
- 서버 컴포넌트에서 `calculateCampAttendanceStats` 직접 호출
- 출석 통계를 props로 클라이언트 컴포넌트에 전달

**After**:
- `prefetchQuery` + `HydrationBoundary` 패턴 적용
- `campAttendanceStatsQueryOptions` 사용
- 클라이언트 컴포넌트에서 `useCampAttendanceStats` 훅 사용

#### 주요 개선점

1. **Server Prefetching**:
   ```typescript
   await queryClient.prefetchQuery(campAttendanceStatsQueryOptions(id));
   ```

2. **클라이언트 훅 사용**:
   ```typescript
   const { data: attendanceStats, isLoading } = useCampAttendanceStats(templateId);
   ```

3. **컴포넌트 수정**:
   - `CampAttendanceDashboard`: `templateId`를 받아서 훅 사용

---

## 🎯 적용된 패턴

### Server Prefetching 패턴

1. **서버 컴포넌트에서 프리패칭**:
   ```typescript
   const queryClient = getQueryClient();
   await queryClient.prefetchQuery(queryOptions(...));
   ```

2. **HydrationBoundary**:
   ```typescript
   <HydrationBoundary state={dehydrate(queryClient)}>
     {/* 클라이언트 컴포넌트 */}
   </HydrationBoundary>
   ```

3. **클라이언트 훅 사용**:
   ```typescript
   const { data, isLoading } = useCampTemplates({ tenantId, ... });
   const { attendance, learning } = useCampStats(templateId);
   ```

---

## 📊 성능 개선

### Before
- 서버에서 모든 데이터 처리 (필터링, 페이지네이션, 통계 계산)
- 클라이언트에서 데이터 변경 시 서버 재요청 필요
- 리포트 데이터 생성 시 전체 리포트 데이터를 한 번에 로드

### After
- 서버에서 데이터 프리패칭만 수행
- 클라이언트에서 React Query 캐시 활용
- 필터/페이지 변경 시 캐시된 데이터 재사용 가능
- 통계 데이터는 별도 쿼리로 분리하여 필요한 것만 로드
- 캐시 전략: 통계 데이터는 5분 staleTime (자주 변하지 않음)

---

## 🔄 데이터 흐름

### 템플릿 목록 페이지
```
1. 서버 컴포넌트 (page.tsx)
   ├─ getCurrentUserRole() - 권한 확인
   ├─ getTenantContext() - 테넌트 정보 조회
   ├─ searchParams 파싱
   └─ queryClient.prefetchQuery() - 템플릿 목록 프리패칭

2. HydrationBoundary
   └─ 서버 상태를 클라이언트에 전달

3. 클라이언트 컴포넌트 (CampTemplatesListContainer)
   ├─ useCampTemplates() - 캐시된 데이터 조회
   ├─ 필터링/페이지네이션 처리
   └─ UI 렌더링
```

### 리포트/출석 페이지
```
1. 서버 컴포넌트 (page.tsx)
   ├─ getCurrentUserRole() - 권한 확인
   ├─ getCampTemplateById() - 템플릿 정보 조회
   ├─ queryClient.prefetchQuery() - 통계 데이터 프리패칭
   └─ templateId를 props로 전달

2. HydrationBoundary
   └─ 서버 상태를 클라이언트에 전달

3. 클라이언트 컴포넌트 (Dashboard)
   ├─ useCampStats() / useCampAttendanceStats() - 캐시된 통계 조회
   └─ UI 렌더링
```

---

## 📝 변경된 파일 목록

### 신규 생성
- `lib/hooks/useCampTemplates.ts` - 캠프 템플릿 목록 조회 훅
- `app/(admin)/admin/camp-templates/_components/CampTemplatesListContainer.tsx` - 클라이언트 컨테이너 컴포넌트

### 수정
- `app/(admin)/admin/camp-templates/page.tsx` - Server Prefetching 패턴 적용
- `app/(admin)/admin/camp-templates/[id]/reports/page.tsx` - useCampStats 적용
- `app/(admin)/admin/camp-templates/[id]/reports/_components/CampReportDashboard.tsx` - 훅 사용
- `app/(admin)/admin/camp-templates/[id]/reports/_components/CampReportSummaryCards.tsx` - Props 변경
- `app/(admin)/admin/camp-templates/[id]/attendance/page.tsx` - useCampStats 적용
- `app/(admin)/admin/camp-templates/[id]/attendance/_components/CampAttendanceDashboard.tsx` - 훅 사용

---

## ✅ 검증 사항

- [x] 린트 에러 없음
- [x] TypeScript 타입 안전성 보장
- [x] Server Prefetching 정상 동작
- [x] 클라이언트 훅 정상 동작
- [x] 필터링/페이지네이션 정상 동작
- [x] 통계 데이터 조회 정상 동작
- [x] 권한 검사 정상 동작

---

## 🎉 완료

캠프 관리 페이지의 데이터 로딩 방식을 React Query 기반 Server Prefetching 패턴으로 성공적으로 전환했습니다. Plan 페이지와 동일한 패턴을 적용하여 일관성 있는 코드베이스를 유지하고 있습니다.

