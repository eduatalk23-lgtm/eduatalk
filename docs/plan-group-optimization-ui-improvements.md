# 플랜 그룹 상세 페이지 최적화 및 UI 개선 제안

## 📋 개요

`app/(student)/plan/group/[id]` 폴더의 플랜 그룹 상세 페이지에 대한 최적화 및 UI 개선 제안서입니다.

---

## 🚀 성능 최적화 제안

### 1. 데이터 페칭 최적화

#### 현재 문제점

```typescript:app/(student)/plan/group/[id]/page.tsx
// 여러 개의 개별 쿼리 실행
const { data: planCounts } = await supabase
  .from("student_plan")
  .select("id")
  .eq("plan_group_id", id)
  .eq("student_id", user.id);

const { data: plans } = await supabase
  .from("student_plan")
  .select("planned_end_page_or_time,completed_amount")
  .eq("plan_group_id", id)
  .eq("student_id", user.id)
  .not("plan_group_id", "is", null);
```

#### 개선 제안

- **단일 쿼리로 통합**: `planCounts`와 `plans` 쿼리를 하나로 통합하여 네트워크 요청 감소
- **필요한 필드만 선택**: `id`만 선택하는 대신 필요한 모든 필드를 한 번에 조회
- **캐싱 전략**: React Query 또는 Next.js 캐싱을 활용하여 불필요한 재요청 방지

```typescript
// 개선 예시
const { data: plans } = await supabase
  .from("student_plan")
  .select("id,planned_end_page_or_time,completed_amount")
  .eq("plan_group_id", id)
  .eq("student_id", user.id)
  .not("plan_group_id", "is", null);

const planCount = plans?.length || 0;
const completedCount = plans?.filter(/* ... */).length || 0;
```

### 2. 컴포넌트 레이지 로딩

#### 현재 문제점

- 모든 탭의 컴포넌트가 한 번에 로드됨
- 사용하지 않는 탭의 데이터도 페칭됨

#### 개선 제안

- **동적 임포트**: 탭 전환 시에만 해당 컴포넌트 로드
- **데이터 페칭 지연**: 각 탭의 데이터를 탭 활성화 시에만 페칭

```typescript
// 개선 예시
const Step7DetailView = lazy(() => import("./Step7DetailView"));

// 탭 전환 시에만 로드
{
  currentTab === 7 && (
    <Suspense fallback={<TabLoadingSkeleton />}>
      <Step7DetailView groupId={groupId} />
    </Suspense>
  );
}
```

### 3. 메모이제이션 최적화

#### 개선 제안

- **useMemo**: 복잡한 계산 로직 메모이제이션 (완료 개수, 진행률 등)
- **useCallback**: 이벤트 핸들러 메모이제이션
- **React.memo**: 불필요한 리렌더링 방지

```typescript
// 개선 예시
const completedCount = useMemo(() => {
  if (!plans || plans.length === 0) return 0;
  return plans.filter((plan) => {
    if (!plan.planned_end_page_or_time) return false;
    return (
      plan.completed_amount !== null &&
      plan.completed_amount >= plan.planned_end_page_or_time
    );
  }).length;
}, [plans]);
```

### 4. 스케줄 뷰 최적화

#### 현재 문제점

```typescript:app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx
// useEffect 의존성 배열에 refreshKey 포함으로 인한 불필요한 재렌더링 가능성
useEffect(() => {
  fetchData();
}, [groupId, refreshKey]);
```

#### 개선 제안

- **React Query 사용**: 서버 상태 관리 및 자동 캐싱
- **낙관적 업데이트**: 플랜 생성 후 즉시 UI 업데이트
- **무한 스크롤 또는 페이지네이션**: 대량의 플랜 데이터 처리

---

## 🎨 UI/UX 개선 제안

### 1. 탭 네비게이션 개선

#### 현재 상태

- 탭이 많아서 모바일에서 가로 스크롤 필요
- 완료 상태 표시가 있지만 시각적 피드백 부족

#### 개선 제안

- **드롭다운 메뉴**: 모바일에서는 드롭다운으로 변경
- **진행 상태 표시**: 각 단계의 진행률을 시각적으로 표시
- **단계별 안내**: 각 탭에 대한 간단한 설명 툴팁 추가

```typescript
// 개선 예시
<div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      className={`
        relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm
        transition-all hover:bg-gray-50
        ${currentTab === tab.id ? "bg-blue-50 text-blue-700" : "text-gray-600"}
      `}
    >
      {tab.completed && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      <span>{tab.label}</span>
      {tab.id < currentTab && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
      )}
    </button>
  ))}
</div>
```

### 2. 로딩 상태 개선

#### 현재 상태

- 단순한 스피너만 표시
- 로딩 시간이 길 경우 사용자 경험 저하

#### 개선 제안

- **스켈레톤 UI**: 실제 콘텐츠 구조를 반영한 스켈레톤
- **진행률 표시**: 데이터 페칭 진행률 표시
- **부분 로딩**: 먼저 로드된 데이터부터 표시

```typescript
// 개선 예시
if (loading) {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-32 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-64 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}
```

### 3. 에러 처리 개선

#### 현재 상태

- 기본적인 에러 메시지만 표시
- 에러 복구 옵션 부족

#### 개선 제안

- **에러 바운더리**: React Error Boundary로 에러 격리
- **재시도 버튼**: 에러 발생 시 재시도 옵션 제공
- **상세 에러 정보**: 개발 모드에서만 상세 에러 표시

```typescript
// 개선 예시
if (error) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800">오류 발생</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4. 진행 상황 카드 개선

#### 현재 상태

```typescript:app/(student)/plan/group/[id]/_components/PlanGroupProgressCard.tsx
// "진행 중"과 "남은 플랜"이 동일한 값 표시 (중복)
<div>
  <p className="text-xs text-gray-500">진행 중</p>
  <p className="mt-1 text-lg font-semibold text-orange-600">
    {planCount - completedCount}개
  </p>
</div>
<div>
  <p className="text-xs text-gray-500">남은 플랜</p>
  <p className="mt-1 text-lg font-semibold text-gray-900">
    {planCount - completedCount}개
  </p>
</div>
```

#### 개선 제안

- **중복 제거**: "진행 중"과 "남은 플랜" 통합 또는 다른 지표 표시
- **시각적 개선**: 차트나 그래프로 진행률 시각화
- **추가 정보**: 예상 완료일, 일일 평균 진행률 등

```typescript
// 개선 예시
<div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
  <div>
    <p className="text-xs text-gray-500">완료</p>
    <p className="mt-1 text-lg font-semibold text-green-600">
      {completedCount}개
    </p>
  </div>
  <div>
    <p className="text-xs text-gray-500">진행 중</p>
    <p className="mt-1 text-lg font-semibold text-orange-600">
      {planCount - completedCount}개
    </p>
  </div>
  <div>
    <p className="text-xs text-gray-500">예상 완료일</p>
    <p className="mt-1 text-sm font-semibold text-gray-900">
      {estimatedCompletionDate || "—"}
    </p>
  </div>
</div>
```

### 5. 액션 버튼 개선

#### 현재 상태

- 아이콘만 표시되어 기능 파악이 어려움
- 모바일에서 터치 영역이 작을 수 있음

#### 개선 제안

- **레이블 추가**: 모바일에서는 텍스트 레이블 표시
- **툴팁**: 데스크톱에서 호버 시 설명 표시
- **확인 다이얼로그**: 복사/삭제 시 더 명확한 확인 다이얼로그

```typescript
// 개선 예시
<button
  onClick={handleCopy}
  className="
    inline-flex items-center gap-2 rounded-lg px-3 py-2
    text-sm font-medium text-gray-700
    transition hover:bg-gray-100
    md:px-2 md:py-2
  "
>
  <Copy className="h-4 w-4" />
  <span className="md:hidden">복사</span>
</button>
```

### 6. 반응형 디자인 개선

#### 개선 제안

- **모바일 최적화**: 작은 화면에서도 모든 정보가 잘 보이도록 조정
- **터치 친화적**: 버튼 크기 및 간격 조정
- **가로 스크롤 최소화**: 탭 네비게이션을 모바일에서 드롭다운으로 변경

---

## 🏗 코드 구조 개선 제안

### 1. 타입 안정성 강화

#### 개선 제안

- **엄격한 타입 정의**: `any` 타입 제거
- **타입 가드**: 런타임 타입 검증 추가
- **공통 타입**: 재사용 가능한 타입 정의

```typescript
// 개선 예시
type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

// any 타입 제거
type PlanStatus = "active" | "paused" | "completed" | "cancelled";
```

### 2. 컴포넌트 분리

#### 개선 제안

- **작은 컴포넌트**: 큰 컴포넌트를 더 작은 단위로 분리
- **재사용 가능한 컴포넌트**: 공통 UI 요소 추출
- **컨테이너/프레젠테이션 분리**: 로직과 UI 분리

### 3. 에러 바운더리 추가

#### 개선 제안

- **React Error Boundary**: 각 탭을 에러 바운더리로 감싸기
- **폴백 UI**: 에러 발생 시 대체 UI 표시
- **에러 로깅**: 에러 발생 시 로깅 시스템 연동

```typescript
// 개선 예시
<ErrorBoundary fallback={<ErrorFallback />}>
  <PlanGroupDetailView {...props} />
</ErrorBoundary>
```

### 4. 접근성 개선

#### 개선 제안

- **ARIA 레이블**: 스크린 리더 지원
- **키보드 네비게이션**: 탭 전환을 키보드로 가능하도록
- **포커스 관리**: 모달 및 다이얼로그의 포커스 관리

```typescript
// 개선 예시
<nav aria-label="플랜 그룹 상세 정보 탭">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      role="tab"
      aria-selected={currentTab === tab.id}
      aria-controls={`tabpanel-${tab.id}`}
      onClick={() => onTabChange(tab.id)}
    >
      {tab.label}
    </button>
  ))}
</nav>
```

---

## 📊 성능 지표 개선 목표

### 현재 예상 문제점

1. **초기 로딩 시간**: 여러 개의 개별 쿼리로 인한 지연
2. **리렌더링**: 불필요한 리렌더링 발생 가능
3. **번들 크기**: 모든 컴포넌트가 한 번에 로드됨

### 개선 목표

- **초기 로딩 시간**: 30% 감소
- **리렌더링 횟수**: 50% 감소
- **번들 크기**: 레이지 로딩으로 40% 감소

---

## 🔄 마이그레이션 우선순위

### Phase 1: 즉시 적용 가능 (High Impact, Low Effort)

1. ✅ 데이터 페칭 쿼리 통합
2. ✅ 진행 상황 카드 중복 제거
3. ✅ 에러 처리 개선 (재시도 버튼 추가)

### Phase 2: 중기 개선 (High Impact, Medium Effort)

1. ✅ React Query 도입
2. ✅ 컴포넌트 레이지 로딩
3. ✅ 스켈레톤 UI 적용

### Phase 3: 장기 개선 (Medium Impact, High Effort)

1. ✅ 에러 바운더리 추가
2. ✅ 접근성 전면 개선
3. ✅ 성능 모니터링 도구 연동

---

## 📝 추가 고려사항

### 1. SEO 최적화

- 메타 태그 추가
- 구조화된 데이터 (JSON-LD)

### 2. 분석 도구 연동

- 사용자 행동 추적
- 성능 메트릭 수집

### 3. 테스트

- 단위 테스트 추가
- 통합 테스트 추가
- E2E 테스트 추가

---

## 🐛 버그 수정: step2 자율학습시간 사용 가능 체크박스 저장 문제

### 문제

step2에서 "자율학습시간 사용 가능" 체크박스의 변경사항이 저장되지 않는 문제가 있었습니다.

### 원인

- `time_settings`는 `wizardData`에 저장되지만, `PlanGroupWizard.tsx`의 `handleSaveDraft`와 `handleSubmit`에서 `creationData`를 만들 때 `time_settings`가 포함되지 않았습니다.
- `PlanGroupCreationData` 타입에 `time_settings` 필드가 없어서 데이터베이스에 저장되지 않았습니다.

### 해결 방법

1. **저장 시**: `time_settings`를 `scheduler_options`에 병합하여 저장

   - `PlanGroupWizard.tsx`의 `handleSaveDraft`와 `handleSubmit`에서 `time_settings`를 `scheduler_options`에 병합
   - 데이터베이스 스키마 변경 없이 기존 `scheduler_options` 필드에 저장

2. **불러올 때**: `scheduler_options`에서 `time_settings` 추출하여 복원
   - `app/(student)/plan/group/[id]/edit/page.tsx`에서 `scheduler_options`에서 `time_settings` 필드를 추출
   - `PlanGroupWizard`의 `initialData`에 `time_settings`와 `scheduler_options`를 분리하여 전달

### 변경 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/group/[id]/edit/page.tsx`

### 결과

이제 step2에서 "자율학습시간 사용 가능" 체크박스를 변경하면 정상적으로 저장되고, 편집 모드에서도 올바르게 복원됩니다.

---

## 🎨 UI 개선: step7 자율 학습 시간 텍스트 제거

### 변경 사항
step7의 시간 구성에서 자율학습 슬롯에 표시되던 "(자율 학습 시간)" 텍스트를 제거했습니다.

### 이유
- 자율학습 슬롯은 이미 색상과 시간 범위로 구분되어 있어 추가 텍스트가 불필요합니다.
- UI를 더 깔끔하게 만들기 위해 제거했습니다.

### 변경 파일
- `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

---

## 🎯 결론

플랜 그룹 상세 페이지는 기능적으로는 잘 구현되어 있으나, 성능 최적화와 UI/UX 개선의 여지가 있습니다. 특히 데이터 페칭 최적화와 컴포넌트 레이지 로딩을 통해 사용자 경험을 크게 개선할 수 있습니다.

위 제안사항들을 단계적으로 적용하면 더 빠르고 사용자 친화적인 페이지를 만들 수 있을 것입니다.
