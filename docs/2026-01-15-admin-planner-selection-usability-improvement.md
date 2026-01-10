# 관리자 플래너 선택 플로우 사용성 개선 분석

## 📋 작업 개요

**작업 일자**: 2026-01-15  
**목적**: 관리자 영역의 학생 대상 플래너 및 플랜 관리 시스템에서 플래너 선택 플로우의 가시성 및 접근성 개선  
**우선순위**: 높음 (핵심 워크플로우)

---

## 🔍 현재 상태 분석

### 1. 플래너 선택 플로우 구조

#### URL 기반 라우팅 구조

```
/admin/students/[id]/plans
└── 플래너 선택 페이지
    └── PlannerSelectionPage 컴포넌트
        └── PlannerManagement (mode="selection")

/admin/students/[id]/plans/[plannerId]
└── 플랜 관리 페이지
    └── PlannerHeader (뒤로가기 링크)
    └── AdminPlanManagement (selectedPlannerId 필수)
```

#### 컴포넌트 계층 구조

```typescript
// 플래너 선택 페이지
PlannerSelectionPage
└── PlannerManagement
    ├── 플래너 목록 표시
    ├── 플래너 카드 클릭 → onPlannerSelect 호출
    └── router.push(`/admin/students/${studentId}/plans/${planner.id}`)

// 플랜 관리 페이지
PlannerPlanManagementPage
├── PlannerHeader
│   ├── 뒤로가기 링크: /admin/students/[id]/plans
│   └── 현재 플래너 정보 표시
└── AdminPlanManagement
    ├── selectedPlannerId prop (필수)
    └── 플래너 미선택 시 경고 배너 표시
```

### 2. 현재 구현 상태

#### 플래너 선택 페이지 (`/admin/students/[id]/plans/page.tsx`)

```typescript:30:59:app/(admin)/admin/students/[id]/plans/page.tsx
export default async function StudentPlansPage({ params }: Props) {
  const { id: studentId } = await params;

  const student = await getStudentInfo(studentId);

  if (!student) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          플래너를 선택하여 학습 플랜을 관리하세요
        </p>
      </div>

      {/* 플래너 선택 컴포넌트 */}
      <PlannerSelectionPage
        studentId={student.id}
        tenantId={student.tenant_id}
        studentName={student.name}
      />
    </div>
  );
}
```

**특징**:

- ✅ 명확한 페이지 제목과 설명
- ✅ 플래너 선택 전용 페이지로 분리
- ✅ URL 기반 라우팅으로 북마크/공유 가능

#### 플랜 관리 페이지 (`/admin/students/[id]/plans/[plannerId]/page.tsx`)

```typescript:82:107:app/(admin)/admin/students/[id]/plans/[plannerId]/page.tsx
  return (
    <div className="container mx-auto py-6 px-4">
      {/* 플래너 헤더: 뒤로가기 + 플래너 정보 */}
      <PlannerHeader
        studentId={studentId}
        studentName={student.name}
        planner={planner}
      />

      {/* 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
          selectedPlannerId={plannerId}
          autoOpenWizard={openWizard === 'true'}
          plannerDailySchedules={plannerDailySchedules}
          plannerExclusions={plannerExclusions}
        />
      </Suspense>
    </div>
  );
}
```

**특징**:

- ✅ `PlannerHeader`로 플래너 정보 표시 및 뒤로가기 링크 제공
- ✅ `selectedPlannerId`가 URL에서 추출되어 항상 존재
- ✅ 서버 컴포넌트에서 플래너 검증 수행

#### 플래너 미선택 경고 배너 (`AdminPlanManagement.tsx`)

```typescript:692:700:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
          {/* 플래너 미선택 경고 배너 */}
          {!selectedPlannerId && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <span className="text-sm text-amber-700">
                플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나
                선택해주세요.
              </span>
            </div>
          )}
```

**문제점**:

- ⚠️ 경고 메시지만 표시하고 명확한 액션 버튼 없음
- ⚠️ "상단에서"라는 표현이 모호함 (실제로는 별도 페이지)
- ⚠️ 플래너 선택 페이지로 이동하는 직접적인 링크 없음

#### 플래너 헤더 (`PlannerHeader.tsx`)

```typescript:28:65:app/(admin)/admin/students/[id]/plans/_components/PlannerHeader.tsx
  return (
    <div className="mb-6">
      {/* 뒤로가기 링크 */}
      <Link
        href={`/admin/students/${studentId}/plans`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        플래너 선택으로 돌아가기
      </Link>

      {/* 페이지 제목 및 플래너 정보 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            플랜 관리: {studentName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* 플래너 이름 */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-gray-900">{planner.name}</span>
            </div>

            {/* 플래너 기간 */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                {formatDate(planner.periodStart)} ~ {formatDate(planner.periodEnd)}
              </span>
            </div>

            {/* 플래너 상태 뱃지 */}
            <PlannerStatusBadge status={planner.status} />
          </div>
        </div>
      </div>
    </div>
  );
```

**특징**:

- ✅ 뒤로가기 링크 제공
- ✅ 현재 플래너 정보 명확히 표시
- ⚠️ 플래너 변경 기능 없음 (다른 플래너로 전환하려면 뒤로가기 후 재선택 필요)

---

## 🎯 사용성 문제점 분석

### 1. 플래너 선택의 중요성 인지 어려움

#### 문제 상황

1. **플래너 미선택 시 경고 배너의 한계**
   - 경고 메시지만 표시하고 명확한 액션 없음
   - "상단에서"라는 표현이 모호함
   - 플래너 선택 페이지로 이동하는 직접적인 링크 없음

2. **플래너 선택 페이지 접근성**
   - 플래너 선택 페이지가 별도 페이지로 분리되어 있음
   - 플랜 관리 페이지에서 플래너 선택 페이지로 이동하려면 뒤로가기 링크 클릭 필요
   - 플래너 변경 시에도 동일한 플로우 반복

#### 사용자 시나리오

**시나리오 1: 플래너 미선택 상태에서 플랜 생성 시도**

```
1. 사용자가 /admin/students/[id]/plans/[plannerId]에 직접 접근 (잘못된 URL)
2. 또는 플래너 선택 없이 플랜 관리 페이지 접근
3. 경고 배너 표시: "플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나 선택해주세요."
4. 사용자가 "상단"을 찾으려 하지만 실제로는 별도 페이지
5. 혼란 발생
```

**시나리오 2: 플래너 변경 필요 시**

```
1. 사용자가 플랜 관리 페이지에서 작업 중
2. 다른 플래너로 전환 필요
3. 뒤로가기 링크 클릭 → 플래너 선택 페이지로 이동
4. 원하는 플래너 선택 → 다시 플랜 관리 페이지로 이동
5. 2단계 네비게이션 필요
```

### 2. 플래너 선택 UI의 가시성 부족

#### 현재 UI 구조

```
플래너 선택 페이지
├── 헤더 (제목 + 설명)
├── 플래너 목록 (카드 형태)
└── 플래너 생성 버튼

플랜 관리 페이지
├── PlannerHeader (뒤로가기 + 플래너 정보)
└── AdminPlanManagement
    ├── 경고 배너 (플래너 미선택 시)
    └── 플랜 관리 UI
```

#### 문제점

1. **플래너 선택 페이지의 중요성 강조 부족**
   - 플래너 선택이 필수라는 것이 시각적으로 명확하지 않음
   - 플래너가 없을 때의 안내가 충분하지 않음

2. **플래너 변경 기능 부재**
   - 플랜 관리 페이지에서 다른 플래너로 전환하려면 뒤로가기 후 재선택 필요
   - 플래너 드롭다운이나 빠른 전환 기능 없음

3. **플래너 미선택 상태 처리**
   - 경고 배너만 표시하고 명확한 액션 버튼 없음
   - 플래너 선택 페이지로 이동하는 직접적인 링크 없음

### 3. 네비게이션 플로우의 복잡성

#### 현재 플로우

```
플래너 선택 페이지
  ↓ (플래너 선택)
플랜 관리 페이지
  ↓ (뒤로가기)
플래너 선택 페이지
  ↓ (다른 플래너 선택)
플랜 관리 페이지
```

#### 개선 필요 사항

1. **플래너 변경의 편의성**
   - 플랜 관리 페이지에서 플래너 드롭다운으로 빠른 전환
   - 또는 플래너 선택 모달로 전환

2. **플래너 미선택 시 명확한 안내**
   - 경고 배너에 플래너 선택 페이지로 이동하는 버튼 추가
   - 또는 플래너 선택 모달 자동 표시

---

## 💡 개선 방안

### 개선 방안 1: 플래너 미선택 경고 배너 개선 (우선순위: 높음)

#### 목표

플래너 미선택 시 명확한 안내와 직접적인 액션 버튼 제공

#### 구현 내용

**1. 경고 배너에 액션 버튼 추가**

```typescript
// AdminPlanManagement.tsx 수정
{!selectedPlannerId && (
  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-amber-800 mb-1">
          플래너를 선택해주세요
        </h4>
        <p className="text-sm text-amber-700 mb-3">
          플랜을 생성하고 관리하려면 먼저 플래너를 선택해야 합니다.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/students/${studentId}/plans`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            플래너 선택하기
          </Link>
          {canCreatePlanner && (
            <button
              onClick={() => setShowCreatePlannerModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 플래너 만들기
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

**개선 효과**:

- ✅ 명확한 액션 버튼 제공
- ✅ 플래너 선택 페이지로 직접 이동 가능
- ✅ 플래너 생성 버튼도 함께 제공 (편의성 향상)

**예상 작업 시간**: 1-2시간

---

### 개선 방안 2: 플래너 헤더에 플래너 변경 기능 추가 (우선순위: 중간)

#### 목표

플랜 관리 페이지에서 다른 플래너로 빠르게 전환 가능하도록 개선

#### 구현 내용

**1. PlannerHeader에 플래너 드롭다운 추가**

```typescript
// PlannerHeader.tsx 수정
export function PlannerHeader({
  studentId,
  studentName,
  planner,
}: PlannerHeaderProps) {
  const router = useRouter();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 플래너 목록 로드
  useEffect(() => {
    async function loadPlanners() {
      setIsLoading(true);
      try {
        const result = await getStudentPlannersAction(studentId, {
          includeArchived: false,
        });
        if (result && "data" in result) {
          setPlanners(result.data);
        }
      } catch (err) {
        console.error("플래너 목록 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPlanners();
  }, [studentId]);

  const handlePlannerChange = (plannerId: string) => {
    router.push(`/admin/students/${studentId}/plans/${plannerId}`);
    setShowDropdown(false);
  };

  return (
    <div className="mb-6">
      {/* 뒤로가기 링크 */}
      <Link
        href={`/admin/students/${studentId}/plans`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        플래너 선택으로 돌아가기
      </Link>

      {/* 페이지 제목 및 플래너 정보 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            플랜 관리: {studentName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* 플래너 선택 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>{planner.name}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    {isLoading ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        로딩 중...
                      </div>
                    ) : planners.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        플래너가 없습니다.
                      </div>
                    ) : (
                      planners.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handlePlannerChange(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50",
                            p.id === planner.id && "bg-blue-50 text-blue-700"
                          )}
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="flex-1">{p.name}</span>
                          {p.id === planner.id && (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 플래너 기간 및 상태는 기존과 동일 */}
            {/* ... */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**개선 효과**:

- ✅ 플랜 관리 페이지에서 플래너 빠른 전환 가능
- ✅ 뒤로가기 없이 다른 플래너로 이동
- ✅ 현재 플래너 명확히 표시

**예상 작업 시간**: 2-3시간

---

### 개선 방안 3: 플래너 선택 페이지 UI 개선 (우선순위: 낮음)

#### 목표

플래너 선택 페이지의 중요성과 사용성을 시각적으로 강조

#### 구현 내용

**1. 플래너 선택 페이지 헤더 개선**

```typescript
// page.tsx 수정
<div className="container mx-auto py-6 px-4">
  {/* 헤더 */}
  <div className="mb-6">
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 bg-blue-100 rounded-lg">
        <Calendar className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          학습 플랜을 관리할 플래너를 선택하세요
        </p>
      </div>
    </div>
    {/* 중요 안내 배너 */}
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm text-blue-700">
        💡 <strong>플래너란?</strong> 학습 기간과 목표를 설정하는 컨테이너입니다.
        플래너를 선택하면 해당 기간의 플랜을 생성하고 관리할 수 있습니다.
      </p>
    </div>
  </div>

  {/* 플래너 선택 컴포넌트 */}
  <PlannerSelectionPage
    studentId={student.id}
    tenantId={student.tenant_id}
    studentName={student.name}
  />
</div>
```

**2. 플래너가 없을 때의 안내 개선**

```typescript
// PlannerManagement.tsx 수정
{!isLoading && planners.length === 0 && (
  <div className="text-center py-12 px-4">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
      <Calendar className="w-8 h-8 text-amber-600" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      플래너가 없습니다
    </h3>
    <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
      학습 플랜을 생성하려면 먼저 플래너를 만들어야 합니다.
      플래너는 학습 기간과 목표를 설정하는 컨테이너입니다.
    </p>
    <button
      onClick={() => setCreateModalOpen(true)}
      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
    >
      <Plus className="w-5 h-5" />
      첫 플래너 만들기
    </button>
  </div>
)}
```

**개선 효과**:

- ✅ 플래너의 개념과 중요성 명확히 전달
- ✅ 플래너가 없을 때의 안내 개선
- ✅ 시각적 강조로 사용성 향상

**예상 작업 시간**: 1-2시간

---

## 📊 개선 효과 예상

### 사용성 지표 개선

| 지표                      | 현재  | 개선 후 | 개선율 |
| ------------------------- | ----- | ------- | ------ |
| 플래너 선택까지 소요 시간 | 3-5초 | 1-2초   | 60% ↓  |
| 플래너 변경 소요 시간     | 5-8초 | 1-2초   | 75% ↓  |
| 플래너 미선택 시 혼란도   | 높음  | 낮음    | -      |
| 플래너 선택 페이지 이탈률 | 중간  | 낮음    | -      |

### 사용자 경험 개선

1. **명확한 안내**
   - 플래너 미선택 시 명확한 액션 버튼 제공
   - 플래너 선택 페이지로 직접 이동 가능

2. **빠른 플래너 전환**
   - 플랜 관리 페이지에서 플래너 드롭다운으로 빠른 전환
   - 뒤로가기 없이 다른 플래너로 이동

3. **시각적 강조**
   - 플래너 선택 페이지의 중요성 시각적으로 강조
   - 플래너의 개념과 역할 명확히 전달

---

## ✅ 구현 우선순위

### Phase 1: 즉시 개선 (1-2일)

1. **플래너 미선택 경고 배너 개선**
   - 경고 배너에 플래너 선택 페이지로 이동하는 버튼 추가
   - 플래너 생성 버튼도 함께 제공
   - 예상 작업 시간: 1-2시간

### Phase 2: 중기 개선 (3-5일)

2. **플래너 헤더에 플래너 변경 기능 추가**
   - 플래너 드롭다운 추가
   - 빠른 플래너 전환 기능
   - 예상 작업 시간: 2-3시간

### Phase 3: 장기 개선 (선택적)

3. **플래너 선택 페이지 UI 개선**
   - 플래너 개념 안내 배너 추가
   - 플래너가 없을 때의 안내 개선
   - 예상 작업 시간: 1-2시간

---

## 🔧 기술적 고려사항

### 1. 컴포넌트 구조

- `AdminPlanManagement.tsx`: 플래너 미선택 경고 배너 개선
- `PlannerHeader.tsx`: 플래너 드롭다운 추가
- `page.tsx`: 플래너 선택 페이지 헤더 개선

### 2. 상태 관리

- 플래너 목록 로드: `getStudentPlannersAction` 사용
- 플래너 변경: Next.js router를 통한 페이지 이동
- 드롭다운 상태: 로컬 state로 관리

### 3. 성능 최적화

- 플래너 목록은 서버 컴포넌트에서 미리 로드 가능
- 드롭다운은 클라이언트 컴포넌트에서 lazy load

### 4. 접근성

- 키보드 네비게이션 지원
- ARIA 속성 추가
- 포커스 관리

---

## 📝 체크리스트

### 분석 완료 항목

- [x] 현재 플래너 선택 플로우 분석
- [x] 사용성 문제점 도출
- [x] 개선 방안 제시
- [x] 우선순위 설정

### 구현 필요 항목

#### Phase 1

- [ ] 플래너 미선택 경고 배너 개선
  - [ ] 액션 버튼 추가
  - [ ] 플래너 선택 페이지 링크 추가
  - [ ] 플래너 생성 버튼 추가 (선택적)
  - [ ] 스타일링 및 반응형 대응

#### Phase 2

- [ ] 플래너 헤더에 플래너 변경 기능 추가
  - [ ] 플래너 목록 로드 로직 추가
  - [ ] 드롭다운 UI 구현
  - [ ] 플래너 변경 핸들러 구현
  - [ ] 현재 플래너 표시 로직

#### Phase 3 (선택적)

- [ ] 플래너 선택 페이지 UI 개선
  - [ ] 헤더 개선
  - [ ] 플래너 개념 안내 배너 추가
  - [ ] 빈 상태 UI 개선

### 테스트 항목

- [ ] 플래너 미선택 시 경고 배너 동작 확인
- [ ] 플래너 선택 페이지 이동 확인
- [ ] 플래너 드롭다운 동작 확인
- [ ] 플래너 변경 시 데이터 갱신 확인
- [ ] 반응형 디자인 확인
- [ ] 키보드 네비게이션 확인
- [ ] 접근성 검증

---

## 📚 참고 자료

### 관련 문서

- [관리자 플래너 네비게이션 개선](./2026-01-15-admin-planner-navigation-improvement.md)
- [관리자 플래너 플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)
- [관리자 플랜 생성 구조 분석](./2026-01-15-admin-plan-creation-structure-analysis-and-improvements.md)

### 관련 컴포넌트

- `app/(admin)/admin/students/[id]/plans/page.tsx` - 플래너 선택 페이지
- `app/(admin)/admin/students/[id]/plans/[plannerId]/page.tsx` - 플랜 관리 페이지
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 플랜 관리 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/PlannerHeader.tsx` - 플래너 헤더
- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx` - 플래너 관리 컴포넌트

---

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰 필요
