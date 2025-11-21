# 플랜 캘린더 UI 개선 제안

## 🎯 개선 목표

1. **시각적 일관성**: 디자인 시스템 컬러와 타이포그래피 통일
2. **사용성 향상**: 직관적인 네비게이션과 정보 접근성 개선
3. **정보 밀도 최적화**: 필요한 정보를 효율적으로 표시
4. **반응형 강화**: 모바일/태블릿/데스크톱 최적화

---

## 📊 주요 개선 사항

### 1. 헤더 영역 개선

#### 현재 문제점

- 뷰 전환 버튼이 텍스트 중심
- 필터 버튼이 단순 토글
- 활성 플랜 그룹 정보가 작은 텍스트로만 표시

#### 개선안

```tsx
// 개선된 헤더 구조
<div className="border-b border-gray-200 bg-white px-4 py-4">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    {/* 왼쪽: 날짜 네비게이션 */}
    <div className="flex items-center gap-3">
      <button className="rounded-lg p-2 hover:bg-gray-100 transition">
        <ChevronLeft className="h-5 w-5 text-gray-600" />
      </button>
      <h2 className="text-xl font-bold text-gray-900">
        {formatMonthYear(currentDate)}
      </h2>
      <button className="rounded-lg p-2 hover:bg-gray-100 transition">
        <ChevronRight className="h-5 w-5 text-gray-600" />
      </button>
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
        오늘
      </button>
    </div>

    {/* 오른쪽: 뷰 전환 및 필터 */}
    <div className="flex items-center gap-2">
      {/* 뷰 전환 버튼 그룹 */}
      <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button className="rounded-md px-3 py-1.5 text-sm font-medium transition">
          월별
        </button>
        <button className="rounded-md px-3 py-1.5 text-sm font-medium transition">
          주별
        </button>
        <button className="rounded-md px-3 py-1.5 text-sm font-medium transition">
          일별
        </button>
      </div>

      {/* 필터 버튼 */}
      <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 transition">
        <Filter className="h-4 w-4" />
        <span>학습시간만</span>
      </button>
    </div>
  </div>

  {/* 활성 플랜 그룹 정보 (개선) */}
  {activePlanGroups.length > 0 && (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">활성 플랜:</span>
      {activePlanGroups.map((group) => (
        <span
          key={group.id}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
        >
          <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
          {group.name}
        </span>
      ))}
    </div>
  )}
</div>
```

**개선 포인트**:

- 뷰 전환 버튼을 그룹화하여 시각적 일관성 향상
- 활성 플랜 그룹에 인디케이터 도트 추가
- 반응형 레이아웃 (모바일: 세로, 데스크톱: 가로)

---

### 2. 월별 뷰 개선

#### 현재 문제점

- 날짜 셀 높이가 고정되어 플랜이 많을 때 정보 손실
- 플랜 정보가 텍스트만으로 표시되어 가독성 낮음
- 날짜 타입 표시가 작고 눈에 잘 안 띔

#### 개선안

```tsx
// 개선된 날짜 셀
<div
  className={`min-h-[120px] border rounded-lg p-2 transition hover:shadow-sm ${bgColorClass}`}
>
  {/* 날짜 헤더 */}
  <div className="mb-2 flex items-center justify-between">
    <div className={`text-base font-bold ${textColorClass}`}>{day}</div>
    {/* 날짜 타입 배지 */}
    {dayTypeInfo && dayType !== "normal" && (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${dayTypeBadgeClass}`}
      >
        {dayTypeInfo.icon} {dayTypeInfo.label}
      </span>
    )}
  </div>

  {/* 플랜 목록 */}
  <div className="flex flex-col gap-1.5">
    {filteredSlots.slice(0, 3).map((slot) => (
      <div
        key={slot.id}
        className="rounded-md bg-white/80 p-1.5 text-xs shadow-sm"
      >
        {/* 플랜 정보 */}
      </div>
    ))}

    {/* 더보기 인디케이터 */}
    {totalItems > 3 && (
      <button className="mt-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">
        +{totalItems - 3}개 더
      </button>
    )}
  </div>
</div>
```

**개선 포인트**:

- 날짜 타입을 배지로 강조
- 플랜 카드에 그림자 효과로 계층감 추가
- 호버 효과로 인터랙션 피드백
- "더보기" 버튼 클릭 시 모달로 전체 플랜 표시

---

### 3. 주별 뷰 개선

#### 현재 문제점

- 플랜 정보가 세로로 길게 나열되어 스크롤이 많음
- 통계 정보가 작게 표시됨
- 시간대별 그룹화가 명확하지 않음

#### 개선안

```tsx
// 개선된 주별 뷰 날짜 컬럼
<div className="flex flex-col gap-3">
  {/* 날짜 헤더 */}
  <div className={`rounded-lg border-2 p-3 ${bgColorClass}`}>
    <div className="mb-2 text-center">
      <div className={`text-lg font-bold ${textColorClass}`}>
        {date.getDate()}
      </div>
      <div className="text-xs text-gray-500">{weekdays[index]}</div>
      {dayTypeInfo && dayType !== "normal" && (
        <div className="mt-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${dayTypeBadgeClass}`}
          >
            {dayTypeInfo.icon} {dayTypeInfo.label}
          </span>
        </div>
      )}
    </div>

    {/* 통계 카드 */}
    {(dayPlans.length > 0 || dayAcademySchedules.length > 0) && (
      <div className="rounded-lg bg-white/60 p-2">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-center">
            <div className="font-bold text-gray-900">{dayPlans.length}</div>
            <div className="text-gray-500">플랜</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-green-600">{completedPlans}</div>
            <div className="text-gray-500">완료</div>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* 타임라인 슬롯 (시간대별 그룹화) */}
  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
    {timeGroups.map((group) => (
      <div
        key={group.timeRange}
        className="rounded-lg border border-gray-200 bg-white p-2"
      >
        <div className="mb-1 text-xs font-medium text-gray-500">
          {group.timeRange}
        </div>
        <div className="flex flex-col gap-1.5">
          {group.slots.map((slot) => (
            <PlanCard key={slot.id} slot={slot} />
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

**개선 포인트**:

- 통계를 카드 형태로 시각화
- 시간대별로 그룹화하여 가독성 향상
- 스크롤 영역 최적화

---

### 4. 일별 뷰 개선

#### 현재 문제점

- 테이블 형식이 모바일에서 가독성 낮음
- 진행률 바가 작고 시각적 효과 부족
- 플랜 상세 정보 접근이 어려움

#### 개선안

```tsx
// 개선된 일별 뷰
<div className="flex flex-col gap-4">
  {/* 헤더 카드 */}
  <div className={`rounded-xl border-2 p-6 ${bgColorClass}`}>
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className={`text-2xl font-bold ${textColorClass}`}>
          {formatDateFull(currentDate)}
        </h2>
        {dayTypeInfo && dayType !== "normal" && (
          <div className="mt-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${dayTypeBadgeClass}`}
            >
              {dayTypeInfo.icon} {dayTypeInfo.label}
            </span>
          </div>
        )}
      </div>

      {/* 통계 대시보드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="총 플랜" value={totalPlans} color="gray" />
        <StatCard label="완료" value={completedPlans} color="green" />
        <StatCard label="진행중" value={activePlans} color="blue" />
        <StatCard
          label="평균 진행률"
          value={`${averageProgress}%`}
          color="indigo"
        />
      </div>
    </div>
  </div>

  {/* 타임라인 (모바일: 카드, 데스크톱: 테이블) */}
  <div className="hidden md:block">{/* 데스크톱 테이블 뷰 */}</div>

  <div className="md:hidden">
    {/* 모바일 카드 뷰 */}
    <div className="flex flex-col gap-3">
      {TIME_BLOCKS.map((block) => (
        <div
          key={block.index}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-gray-900">{block.label}</div>
            <div className="text-sm text-gray-500">{block.time}</div>
          </div>

          {blockPlans.map((plan) => (
            <PlanCardMobile key={plan.id} plan={plan} />
          ))}
        </div>
      ))}
    </div>
  </div>
</div>
```

**개선 포인트**:

- 반응형 디자인: 모바일은 카드, 데스크톱은 테이블
- 통계 대시보드를 카드 그리드로 시각화
- 진행률 바 크기 및 색상 개선

---

### 5. 플랜 카드 컴포넌트 개선

#### 새로운 플랜 카드 디자인

```tsx
// 재사용 가능한 플랜 카드 컴포넌트
function PlanCard({
  plan,
  compact = false,
}: {
  plan: PlanWithContent;
  compact?: boolean;
}) {
  const contentTypeIcon = CONTENT_TYPE_EMOJIS[plan.content_type];
  const isCompleted = plan.progress !== null && plan.progress >= 100;
  const isActive = plan.actual_start_time && !plan.actual_end_time;
  const progressPercentage =
    plan.progress !== null ? Math.round(plan.progress) : null;

  return (
    <div
      className={`group rounded-lg border p-3 transition hover:shadow-md ${
        isCompleted
          ? "border-green-200 bg-green-50"
          : isActive
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 왼쪽: 콘텐츠 정보 */}
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">{contentTypeIcon}</span>
            <h3 className="font-semibold text-gray-900">{plan.contentTitle}</h3>
            {isCompleted && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                완료
              </span>
            )}
            {isActive && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                학습 중
              </span>
            )}
          </div>

          {/* 메타 정보 */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {plan.contentSubjectCategory && (
              <span className="rounded bg-gray-100 px-2 py-0.5">
                {plan.contentSubjectCategory}
              </span>
            )}
            {plan.contentSubject && <span>{plan.contentSubject}</span>}
            {plan.start_time && plan.end_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {plan.start_time} ~ {plan.end_time}
              </span>
            )}
          </div>

          {/* 범위 정보 */}
          {plan.planned_start_page_or_time !== null && (
            <div className="mt-2 text-xs text-gray-500">
              {plan.content_type === "book" ? (
                <>
                  📖 {plan.planned_start_page_or_time}-
                  {plan.planned_end_page_or_time}페이지
                </>
              ) : (
                <>🎧 {plan.planned_start_page_or_time}강</>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 진행률 */}
        {progressPercentage !== null && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-bold text-gray-700">
              {progressPercentage}%
            </span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all ${
                  isCompleted
                    ? "bg-green-500"
                    : isActive
                    ? "bg-blue-500"
                    : "bg-gray-400"
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**개선 포인트**:

- 상태별 색상 코딩 강화
- 호버 효과로 인터랙션 피드백
- 진행률 바 크기 및 위치 개선
- 메타 정보를 배지로 시각화

---

### 6. 통계 대시보드 추가

#### 새로운 통계 컴포넌트

```tsx
// 통계 카드 컴포넌트
function StatCard({ label, value, color = "gray" }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-900",
    green: "bg-green-100 text-green-900",
    blue: "bg-blue-100 text-blue-900",
    indigo: "bg-indigo-100 text-indigo-900",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

// 주간/월간 통계 요약
function CalendarStats({ plans }: { plans: PlanWithContent[] }) {
  const totalPlans = plans.length;
  const completedPlans = plans.filter(
    (p) => p.progress !== null && p.progress >= 100
  ).length;
  const averageProgress =
    totalPlans > 0
      ? Math.round(
          plans.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans
        )
      : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">학습 통계</h3>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="총 플랜" value={totalPlans} color="gray" />
        <StatCard label="완료" value={completedPlans} color="green" />
        <StatCard
          label="평균 진행률"
          value={`${averageProgress}%`}
          color="indigo"
        />
      </div>
    </div>
  );
}
```

---

### 7. 검색 및 필터 기능 강화

#### 개선된 필터 UI

```tsx
// 필터 드로어/모달
function CalendarFilters({
  onFilterChange,
}: {
  onFilterChange: (filters: FilterState) => void;
}) {
  const [filters, setFilters] = useState<FilterState>({
    contentTypes: [],
    subjects: [],
    status: "all", // all, completed, active, pending
    dateRange: null,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">필터</h3>
        <button className="text-sm text-indigo-600 hover:text-indigo-700">
          초기화
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* 콘텐츠 타입 필터 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            콘텐츠 타입
          </label>
          <div className="flex flex-wrap gap-2">
            {["book", "lecture", "custom"].map((type) => (
              <button
                key={type}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filters.contentTypes.includes(type)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {CONTENT_TYPE_EMOJIS[type]} {type}
              </button>
            ))}
          </div>
        </div>

        {/* 상태 필터 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            상태
          </label>
          <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">전체</option>
            <option value="completed">완료</option>
            <option value="active">진행 중</option>
            <option value="pending">대기</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```

---

### 8. 플랜 상세 모달 추가

#### 플랜 상세 정보 모달

```tsx
function PlanDetailModal({
  plan,
  isOpen,
  onClose,
}: {
  plan: PlanWithContent | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!plan || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">플랜 상세</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* 기본 정보 */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-2 font-semibold text-gray-900">기본 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">콘텐츠:</span>
                <span className="ml-2 font-medium">{plan.contentTitle}</span>
              </div>
              <div>
                <span className="text-gray-500">타입:</span>
                <span className="ml-2 font-medium">{plan.content_type}</span>
              </div>
            </div>
          </div>

          {/* 진행 정보 */}
          {plan.progress !== null && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-2 font-semibold text-gray-900">진행 정보</h3>
              <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${plan.progress}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {Math.round(plan.progress)}% 완료
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 디자인 시스템 적용

### 컬러 팔레트

```tsx
// 플랜 상태별 컬러
const PLAN_STATUS_COLORS = {
  completed: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    badge: "bg-green-100 text-green-800",
  },
  active: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-800",
  },
  pending: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-800",
    badge: "bg-gray-100 text-gray-800",
  },
};

// 날짜 타입별 컬러
const DAY_TYPE_COLORS = {
  학습일: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
  },
  복습일: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  지정휴일: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    badge: "bg-red-100 text-red-800",
  },
};
```

### 타이포그래피

```tsx
// 가이드라인에 정의된 타이포그래피 사용
<h1 className="text-display-1">플랜 캘린더</h1>
<h2 className="text-h2">2025년 1월</h2>
<p className="text-body-2">활성화된 플랜 그룹의 플랜을 확인하세요</p>
```

---

## 📱 반응형 디자인

### 브레이크포인트 전략

```tsx
// 모바일 우선 접근
<div className="flex flex-col gap-4 md:flex-row md:gap-6">
  {/* 모바일: 세로 스택, 데스크톱: 가로 배치 */}
</div>

// 그리드 반응형
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* 모바일: 1열, 태블릿: 2열, 데스크톱: 3열 */}
</div>
```

---

## ✅ 구현 우선순위

### Phase 1: 핵심 개선 (1주)

1. ✅ 헤더 영역 개선 (뷰 전환, 필터)
2. ✅ 플랜 카드 컴포넌트 개선
3. ✅ 통계 대시보드 추가

### Phase 2: 뷰별 개선 (1주)

4. ✅ 월별 뷰 개선
5. ✅ 주별 뷰 개선
6. ✅ 일별 뷰 개선 (반응형)

### Phase 3: 고급 기능 (1주)

7. ✅ 검색 및 필터 강화
8. ✅ 플랜 상세 모달
9. ✅ 애니메이션 및 인터랙션

---

## 🚀 다음 단계

1. **디자인 시스템 컬러 정의**: `globals.css`에 컬러 팔레트 추가
2. **컴포넌트 분리**: 재사용 가능한 컴포넌트로 분리
3. **점진적 적용**: 기존 코드를 단계적으로 개선
4. **사용자 테스트**: 개선 사항에 대한 피드백 수집
