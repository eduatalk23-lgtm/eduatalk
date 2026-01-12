# 관리자 영역 플래너 필터링 및 일괄 작업 모달 스크롤 문제 분석

## 작업 일자

2026-01-15

## 개요

관리자 영역에서 선택한 학생의 플랜 관리 부분에서 두 가지 문제점을 분석하고 문서화합니다:

1. 선택한 플래너에 대한 부분만 조회되지 않는 문제
2. 데일리 독에서 일괄 작업 진행 시 모달의 스크롤이 없어 다음 작업 진행이 어려운 문제

---

## 문제 1: 플래너 필터링 미적용 문제

### 문제 현상

관리자 영역에서 학생의 플랜 관리 페이지에서 플래너를 선택했을 때, 선택한 플래너에 속한 플랜만 조회되어야 하지만, 모든 플랜이 조회되는 문제가 발생합니다.

### 영향 범위

- **Daily Dock**: 플래너 필터링이 적용됨 ✅
- **Weekly Dock**: 플래너 필터링이 적용됨 ✅
- **Unfinished Dock**: 플래너 필터링이 적용됨 ✅
- **필터링된 플랜 목록 조회 (`getFilteredPlans`)**: 플래너 필터링이 적용되지 않음 ❌

### 원인 분석

#### 1. `getFilteredPlans` 함수에 `plannerId` 파라미터 부재

**파일**: `lib/domains/admin-plan/actions/filter.ts`

```typescript:lib/domains/admin-plan/actions/filter.ts
export interface PlanFilterParams {
  studentId: string;
  search?: string;
  status?: 'all' | 'pending' | 'in_progress' | 'completed';
  subject?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  containerType?: 'all' | 'daily' | 'weekly' | 'unfinished';
  limit?: number;
  offset?: number;
  // ❌ plannerId 파라미터가 없음
}

export async function getFilteredPlans(
  params: PlanFilterParams
): Promise<AdminPlanResponse<FilterResult>> {
  // ...
  let query = supabase
    .from('student_plan')
    .select(/* ... */)
    .eq('student_id', params.studentId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // ❌ plannerId 필터링 로직이 없음
  // ...
}
```

#### 2. Dock 컴포넌트는 플래너 필터링 지원

**파일**: `lib/query-options/adminDock.ts`

Daily/Weekly/Unfinished Dock은 `plannerId` 파라미터를 받아 필터링을 수행합니다:

```typescript:lib/query-options/adminDock.ts
export function dailyPlansQueryOptions(studentId: string, date: string, plannerId?: string) {
  return queryOptions({
    queryKey: adminDockKeys.daily(studentId, date, plannerId),
    queryFn: async (): Promise<DailyPlan[]> => {
      // ...
      if (plannerId) {
        // plan_groups와 조인하여 planner_id로 필터링
        const { data, error } = await supabase
          .from('student_plan')
          .select(/* ... */)
          .eq('plan_groups.planner_id', plannerId)
          // ...
      }
      // ...
    }
  });
}
```

#### 3. 플래너 선택 상태 전달 경로

**파일**: `app/(admin)/admin/students/[id]/plans/_components/StudentPlansPageClient.tsx`

```typescript:app/(admin)/admin/students/[id]/plans/_components/StudentPlansPageClient.tsx
export function StudentPlansPageClient({ ... }) {
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);

  return (
    <div>
      <PlannerManagement
        onPlannerSelect={handlePlannerSelect}
        selectedPlannerId={selectedPlanner?.id}
      />
      <AdminPlanManagement
        selectedPlannerId={selectedPlanner?.id}  // ✅ 전달됨
      />
    </div>
  );
}
```

`selectedPlannerId`는 `AdminPlanManagement`로 전달되지만, `getFilteredPlans`를 호출하는 곳에서는 사용되지 않습니다.

### 데이터베이스 스키마 관계

```
planners (플래너)
  └─ id

plan_groups (플랜 그룹)
  ├─ id
  ├─ planner_id (FK → planners.id)
  └─ ...

student_plan (학생 플랜)
  ├─ id
  ├─ plan_group_id (FK → plan_groups.id)
  └─ ...
```

플래너와 플랜의 관계는 `plan_groups`를 통해 연결됩니다:

- `planners` → `plan_groups` (1:N)
- `plan_groups` → `student_plan` (1:N)

따라서 플래너로 필터링하려면 `plan_groups`와 조인하여 `planner_id`로 필터링해야 합니다.

### 해결 방안

#### 방안 1: `getFilteredPlans`에 `plannerId` 파라미터 추가 (권장)

```typescript
export interface PlanFilterParams {
  studentId: string;
  plannerId?: string;  // ✅ 추가
  search?: string;
  // ...
}

export async function getFilteredPlans(
  params: PlanFilterParams
): Promise<AdminPlanResponse<FilterResult>> {
  // ...
  let query = supabase
    .from('student_plan')
    .select(/* ... */)
    .eq('student_id', params.studentId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // ✅ 플래너 필터링 추가
  if (params.plannerId) {
    query = query
      .select(/* ... */, 'plan_groups!inner(planner_id)')
      .eq('plan_groups.planner_id', params.plannerId);
  }

  // ...
}
```

#### 방안 2: 클라이언트에서 필터링 (비권장)

클라이언트에서 모든 플랜을 가져온 후 필터링하는 방식은 성능 문제가 있습니다.

### 관련 파일 목록

1. **필터링 액션**: `lib/domains/admin-plan/actions/filter.ts`
2. **Dock 쿼리 옵션**: `lib/query-options/adminDock.ts`
3. **페이지 클라이언트**: `app/(admin)/admin/students/[id]/plans/_components/StudentPlansPageClient.tsx`
4. **플랜 관리 컴포넌트**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

---

## 문제 2: 데일리 독 일괄 작업 모달 스크롤 문제

### 문제 현상

데일리 독에서 일괄 작업 모달(`BulkRedistributeModal`)을 열었을 때, 작업 옵션이 많아지면 모달 내부의 스크롤이 제대로 작동하지 않아 다음 작업을 진행하기 어려운 문제가 발생합니다.

### 영향 범위

- **BulkRedistributeModal**: 스크롤 문제 발생 ❌
- 모달 내부 작업 선택 섹션에서 여러 옵션이 펼쳐질 때 스크롤 영역이 명확하지 않음

### 원인 분석

#### 1. 모달 구조 문제

**파일**: `app/(admin)/admin/students/[id]/plans/_components/BulkRedistributeModal.tsx`

```typescript:app/(admin)/admin/students/[id]/plans/_components/BulkRedistributeModal.tsx
return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div
      className={cn(
        'bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden',  // ❌ overflow-hidden
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      {/* 헤더 */}
      <div className="p-4 border-b">
        {/* ... */}
      </div>

      {/* 선택된 플랜 목록 */}
      <div className="p-4 border-b max-h-48 overflow-y-auto">  // ✅ 스크롤 있음
        {/* ... */}
      </div>

      {/* 작업 선택 */}
      <div className="p-4 space-y-3">  // ❌ 스크롤 없음, overflow 설정 없음
        {/* 여러 작업 옵션들... */}
        {/* - Daily로 이동 */}
        {/* - Weekly로 이동 */}
        {/* - 삭제 */}
        {/* - 일괄 수정 (펼쳐지면 많은 필드) */}
        {/* - 복사 (펼쳐지면 많은 필드) */}
        {/* - 그룹 이동 */}
        {/* - 템플릿 저장 */}
      </div>

      {/* 푸터 */}
      <div className="p-4 border-t flex justify-end gap-2">
        {/* ... */}
      </div>
    </div>
  </div>
);
```

#### 2. 문제점 상세

1. **모달 컨테이너**: `overflow-hidden`으로 설정되어 있어 내부 스크롤이 차단됨
2. **작업 선택 섹션**: 스크롤 영역이 명확하지 않음
3. **동적 콘텐츠**: 작업 옵션이 펼쳐질 때 높이가 증가하지만 스크롤 처리 없음
4. **고정 헤더/푸터**: 헤더와 푸터가 고정되어 있어 중간 콘텐츠 영역만 스크롤되어야 함

#### 3. 현재 구조 분석

```
┌─────────────────────────────────┐
│ 헤더 (고정)                      │
├─────────────────────────────────┤
│ 선택된 플랜 목록 (max-h-48)      │ ← 스크롤 있음
├─────────────────────────────────┤
│ 작업 선택 (스크롤 없음)           │ ← ❌ 문제 영역
│   - Daily로 이동                 │
│   - Weekly로 이동                │
│   - 삭제                         │
│   - 일괄 수정 (펼쳐짐)            │
│     - 상태 변경                  │
│     - 컨테이너 변경              │
│     - 예상 시간 변경             │
│   - 복사 (펼쳐짐)                 │
│     - 날짜 입력                  │
│     - 날짜 목록                  │
│     - 다른 학생에게 복사         │
│   - 그룹 이동                     │
│   - 템플릿 저장                   │
├─────────────────────────────────┤
│ 푸터 (고정)                      │
└─────────────────────────────────┘
```

### 해결 방안

#### 방안 1: Flexbox 레이아웃으로 스크롤 영역 명확화 (권장)

```typescript
return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
      {/* 헤더 (고정) */}
      <div className="flex-shrink-0 p-4 border-b">
        {/* ... */}
      </div>

      {/* 선택된 플랜 목록 (스크롤 가능) */}
      <div className="flex-shrink-0 p-4 border-b max-h-48 overflow-y-auto">
        {/* ... */}
      </div>

      {/* 작업 선택 (스크롤 가능, flex-1로 남은 공간 차지) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 작업 옵션들... */}
      </div>

      {/* 푸터 (고정) */}
      <div className="flex-shrink-0 p-4 border-t flex justify-end gap-2">
        {/* ... */}
      </div>
    </div>
  </div>
);
```

**핵심 변경사항**:

1. 모달 컨테이너: `flex flex-col` 추가
2. 헤더/푸터: `flex-shrink-0`로 고정
3. 작업 선택 섹션: `flex-1 overflow-y-auto`로 스크롤 가능하게 설정

#### 방안 2: 최대 높이 제한과 스크롤

```typescript
<div className="p-4 space-y-3 max-h-[calc(90vh-300px)] overflow-y-auto">
  {/* 작업 옵션들... */}
</div>
```

이 방식은 계산이 복잡하고 반응형 대응이 어렵습니다.

#### 방안 3: Dialog 컴포넌트 사용 (장기적 개선)

현재 커스텀 모달 대신 `components/ui/Dialog`를 사용하면 일관된 스크롤 처리를 제공할 수 있습니다.

### 관련 파일 목록

1. **일괄 작업 모달**: `app/(admin)/admin/students/[id]/plans/_components/BulkRedistributeModal.tsx`
2. **데일리 독**: `app/(admin)/admin/students/[id]/plans/_components/DailyDock.tsx`
3. **Dialog 컴포넌트**: `components/ui/Dialog.tsx` (참고용)

---

## 우선순위 및 권장 사항

### 우선순위

1. **높음**: 문제 2 (일괄 작업 모달 스크롤)
   - 사용자 경험에 직접적인 영향
   - 즉시 수정 가능

2. **중간**: 문제 1 (플래너 필터링)
   - 기능 완성도 문제
   - 데이터베이스 쿼리 수정 필요

### 권장 구현 순서

1. **1단계**: 일괄 작업 모달 스크롤 개선
   - Flexbox 레이아웃 적용
   - 테스트 및 검증

2. **2단계**: 플래너 필터링 추가
   - `getFilteredPlans`에 `plannerId` 파라미터 추가
   - 데이터베이스 쿼리 수정
   - 클라이언트에서 `plannerId` 전달 확인

---

## 테스트 시나리오

### 문제 1 테스트

1. 관리자 영역에서 학생 선택
2. 플래너 A 선택
3. 플랜 목록 조회
4. **예상 결과**: 플래너 A에 속한 플랜만 표시
5. **현재 결과**: 모든 플랜 표시 ❌

### 문제 2 테스트

1. 데일리 독에서 여러 플랜 선택
2. "일괄 작업" 버튼 클릭
3. 모달 열림
4. "일괄 수정" 옵션 선택
5. 여러 필드 펼치기
6. **예상 결과**: 모달 내부 스크롤 가능
7. **현재 결과**: 스크롤 불가, 하단 옵션 확인 불가 ❌

---

## 참고 자료

- [Supabase 조인 쿼리 문서](https://supabase.com/docs/guides/database/joins-and-nested-queries)
- [Flexbox 레이아웃 가이드](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- 프로젝트 Dialog 컴포넌트: `components/ui/Dialog.tsx`

---

## 결론

두 가지 문제 모두 사용자 경험에 영향을 미치며, 특히 일괄 작업 모달의 스크롤 문제는 즉시 수정이 필요합니다. 플래너 필터링 문제는 기능 완성도를 위해 반드시 해결해야 합니다.


